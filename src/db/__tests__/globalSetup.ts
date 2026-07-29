import { execSync } from 'child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import {
  TEST_DATABASE_PREFIX,
  createTestDatabaseUrl,
  getAdminUrl,
  getDatabaseName,
  isStaleTestDatabase,
} from './test-database-url.js';

/**
 * Подготовка базы для интеграционных тестов.
 *
 * Каждый запуск заводит собственную базу и удаляет её после прогона — иначе два
 * одновременных запуска затирают данные друг другу через `cleanDatabase()`.
 * Имя базы передаётся рабочим процессам через `DATABASE_URL_TEST`: они наследуют
 * переменные окружения главного процесса при создании.
 *
 * Если `DATABASE_URL_TEST` задана снаружи (CI), она используется как есть —
 * базу не создаём и не удаляем, только накатываем миграции.
 *
 * Что нужно локально: `docker compose up -d postgres redis`
 */
export default async function globalSetup(): Promise<(() => Promise<void>) | undefined> {
  const externalUrl = process.env.DATABASE_URL_TEST;
  const testDbUrl = externalUrl ?? createTestDatabaseUrl();
  process.env.DATABASE_URL_TEST = testDbUrl;

  if (externalUrl) {
    console.log('\n🔧 Используется база из DATABASE_URL_TEST');
    applyMigrations(testDbUrl);
    return undefined;
  }

  console.log(`\n🔧 База под этот запуск: ${getDatabaseName(testDbUrl)}`);
  await withAdminClient(testDbUrl, async (client) => {
    await dropStaleDatabases(client);
    await client.$executeRawUnsafe(`CREATE DATABASE "${getDatabaseName(testDbUrl)}"`);
  });
  applyMigrations(testDbUrl);

  return async () => {
    await withAdminClient(testDbUrl, async (client) => {
      await dropDatabase(client, getDatabaseName(testDbUrl));
    });
    console.log(`🧹 База ${getDatabaseName(testDbUrl)} удалена`);
  };
}

/** Открывает подключение к служебной базе, выполняет действие и закрывает подключение. */
async function withAdminClient(
  testDbUrl: string,
  run: (client: PrismaClient) => Promise<void>
): Promise<void> {
  const adapter = new PrismaPg({ connectionString: getAdminUrl(testDbUrl) });
  const client = new PrismaClient({ adapter });
  try {
    await run(client);
  } finally {
    await client.$disconnect();
  }
}

/** Удаляет базы, оставшиеся от запусков, которые убили до уборки. */
async function dropStaleDatabases(client: PrismaClient): Promise<void> {
  const rows = await client.$queryRawUnsafe<{ datname: string }[]>(
    `SELECT datname FROM pg_database WHERE datname LIKE $1`,
    `${TEST_DATABASE_PREFIX}%`
  );
  const now = Date.now();
  for (const { datname } of rows) {
    if (!isStaleTestDatabase(datname, now)) {
      continue;
    }
    await dropDatabase(client, datname);
    console.log(`🧹 Удалена забытая база ${datname}`);
  }
}

/** FORCE обрывает подключения, оставшиеся от упавшего запуска. */
async function dropDatabase(client: PrismaClient, databaseName: string): Promise<void> {
  await client.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
}

function applyMigrations(databaseUrl: string): void {
  try {
    execSync(`pnpm exec prisma migrate deploy`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    console.log('✅ Миграции накатаны\n');
  } catch (error) {
    console.error('❌ Не удалось накатить миграции. Запущен ли Docker?');
    console.error('   Выполните: docker compose up -d postgres redis');
    throw error;
  }
}

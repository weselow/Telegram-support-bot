import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { getTestDatabaseUrl } from './test-database-url.js';

const adapter = new PrismaPg({
  connectionString: getTestDatabaseUrl(),
});

export const testPrisma = new PrismaClient({ adapter });

export async function connectTestDatabase(): Promise<void> {
  await testPrisma.$connect();
}

export async function disconnectTestDatabase(): Promise<void> {
  await testPrisma.$disconnect();
}

/**
 * Очищает тестовую базу целиком.
 *
 * Затрагивает все строки, а не только созданные вызывающим файлом, поэтому
 * интеграционные файлы обязаны выполняться по очереди
 * (`fileParallelism: false` в vitest.integration.config.ts), а каждый запуск
 * тестов получает собственную базу (см. test-database-url.ts).
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in order respecting foreign keys
  await testPrisma.messageMap.deleteMany();
  await testPrisma.ticketEvent.deleteMany();
  await testPrisma.user.deleteMany();
}

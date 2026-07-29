/**
 * Адрес базы для интеграционных тестов — единственное место, где он вычисляется.
 *
 * Каждый запуск `pnpm run test:integration` получает собственную базу. Иначе два
 * одновременных запуска затирают данные друг другу: `cleanDatabase()` очищает
 * базу целиком, и строки, созданные соседним запуском, исчезают у него из-под ног.
 *
 * Имя выбирается один раз в `globalSetup.ts` и попадает к рабочим процессам через
 * переменную окружения `DATABASE_URL_TEST` — они наследуют её при создании.
 * Если переменная задана снаружи (так делает CI), она используется как есть:
 * там каждый запуск и так изолирован в своём контейнере.
 */

/** Префикс имени базы, созданной под один запуск тестов. */
export const TEST_DATABASE_PREFIX = 'support_bot_test_';

/** Сервер тестовой PostgreSQL — контейнер `support-bot-postgres` из docker-compose. */
const TEST_DATABASE_SERVER = 'postgresql://postgres:postgres@localhost:5433';

/** Служебная база PostgreSQL, через которую создаются и удаляются остальные. */
const ADMIN_DATABASE_NAME = 'postgres';

/** Через сколько база считается забытой (запуск убили, уборка не отработала). */
const STALE_AFTER_MS = 60 * 60 * 1000;

/** Порождает адрес новой базы под текущий запуск тестов. */
export function createTestDatabaseUrl(): string {
  const createdAt = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${TEST_DATABASE_SERVER}/${TEST_DATABASE_PREFIX}${createdAt}_${random}`;
}

/** Возвращает адрес базы текущего запуска. Вызывается в рабочих процессах. */
export function getTestDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST не задана. Интеграционные тесты запускаются только через ' +
        '`pnpm run test:integration` — базу под запуск заводит globalSetup.'
    );
  }
  return url;
}

/** Имя базы из адреса подключения. */
export function getDatabaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}

/** Адрес служебной базы на том же сервере — через неё создаём и удаляем базы запусков. */
export function getAdminUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${ADMIN_DATABASE_NAME}`;
  return url.toString();
}

/** База осталась от запуска, который не убрал её за собой. */
export function isStaleTestDatabase(databaseName: string, now: number): boolean {
  if (!databaseName.startsWith(TEST_DATABASE_PREFIX)) {
    return false;
  }
  const createdAtPart = databaseName.slice(TEST_DATABASE_PREFIX.length).split('_')[0] ?? '';
  const createdAt = parseInt(createdAtPart, 36);
  return Number.isFinite(createdAt) && now - createdAt > STALE_AFTER_MS;
}

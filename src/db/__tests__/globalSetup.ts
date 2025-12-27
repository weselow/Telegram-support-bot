import { execSync } from 'child_process';

/**
 * Global setup for integration tests.
 *
 * Prerequisites:
 * 1. Start Docker containers: `docker-compose up -d postgres redis`
 * 2. Ensure DATABASE_URL_TEST is set in .env or use default
 */
export default async function globalSetup(): Promise<void> {
  const testDbUrl =
    process.env.DATABASE_URL_TEST ||
    'postgresql://postgres:postgres@localhost:5433/support_bot_test';

  console.log('\n🔧 Setting up integration test database...');

  // Create test database if not exists (ignore error if exists)
  try {
    execSync(
      `docker exec support-bot-postgres psql -U postgres -c "CREATE DATABASE support_bot_test;"`,
      { stdio: 'pipe' }
    );
    console.log('✅ Test database created');
  } catch {
    console.log('ℹ️  Test database already exists');
  }

  // Run migrations on test database
  try {
    execSync(`pnpm exec prisma migrate deploy`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: testDbUrl },
    });
    console.log('✅ Migrations applied\n');
  } catch (error) {
    console.error('❌ Failed to apply migrations. Is Docker running?');
    console.error('   Run: docker-compose up -d postgres');
    throw error;
  }
}

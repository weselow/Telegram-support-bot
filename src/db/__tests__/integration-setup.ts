/**
 * Integration test setup - runs before each test file
 * Sets environment variables so production modules use test database
 */

// Set DATABASE_URL to test database BEFORE any modules are loaded
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://postgres:postgres@localhost:5433/support_bot_test';

// Set other required env variables for tests
process.env.BOT_TOKEN = 'test-token';
process.env.SUPPORT_GROUP_ID = '-1001234567890';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.BOT_USERNAME = 'test_bot';
process.env.HTTP_PORT = '0'; // Use random port

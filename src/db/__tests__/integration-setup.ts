/**
 * Integration test setup - runs before each test file
 * Sets environment variables so production modules use test database
 */
import { getTestDatabaseUrl } from './test-database-url.js';

// Set DATABASE_URL to test database BEFORE any modules are loaded
process.env.DATABASE_URL = getTestDatabaseUrl();

// Set other required env variables for tests
process.env.BOT_TOKEN = 'test-token';
process.env.SUPPORT_GROUP_ID = '-1001234567890';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
process.env.BOT_USERNAME = 'test_bot';
process.env.HTTP_PORT = '0'; // Use random port

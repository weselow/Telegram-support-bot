import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TEST_DATABASE_PREFIX,
  createTestDatabaseUrl,
  getTestDatabaseUrl,
  getAdminUrl,
  getDatabaseName,
  isStaleTestDatabase,
} from './test-database-url.js';

const HOUR_MS = 60 * 60 * 1000;

describe('test-database-url', () => {
  describe('createTestDatabaseUrl', () => {
    it('should build url with the test database prefix', () => {
      const url = createTestDatabaseUrl();

      expect(getDatabaseName(url).startsWith(TEST_DATABASE_PREFIX)).toBe(true);
    });

    it('should build a different url on each call', () => {
      const first = createTestDatabaseUrl();
      const second = createTestDatabaseUrl();

      expect(first).not.toBe(second);
    });

    it('should build a name that is not stale right away', () => {
      const name = getDatabaseName(createTestDatabaseUrl());

      expect(isStaleTestDatabase(name, Date.now())).toBe(false);
    });
  });

  describe('getTestDatabaseUrl', () => {
    const saved = process.env.DATABASE_URL_TEST;

    beforeEach(() => {
      delete process.env.DATABASE_URL_TEST;
    });

    afterEach(() => {
      if (saved === undefined) {
        delete process.env.DATABASE_URL_TEST;
      } else {
        process.env.DATABASE_URL_TEST = saved;
      }
    });

    it('should return DATABASE_URL_TEST when it is set', () => {
      process.env.DATABASE_URL_TEST = 'postgresql://postgres:postgres@localhost:5433/some_db';

      expect(getTestDatabaseUrl()).toBe('postgresql://postgres:postgres@localhost:5433/some_db');
    });

    it('should throw when DATABASE_URL_TEST is not set', () => {
      expect(() => getTestDatabaseUrl()).toThrow('DATABASE_URL_TEST');
    });
  });

  describe('getDatabaseName', () => {
    it('should extract the database name from the url', () => {
      const name = getDatabaseName('postgresql://postgres:postgres@localhost:5433/support_bot_x');

      expect(name).toBe('support_bot_x');
    });
  });

  describe('getAdminUrl', () => {
    it('should point to the postgres maintenance database on the same server', () => {
      const admin = getAdminUrl('postgresql://user:pass@localhost:5433/support_bot_test_x');

      expect(admin).toBe('postgresql://user:pass@localhost:5433/postgres');
    });
  });

  describe('isStaleTestDatabase', () => {
    const now = Date.UTC(2026, 6, 29, 12, 0, 0);
    const nameCreatedAt = (createdAt: number): string =>
      `${TEST_DATABASE_PREFIX}${createdAt.toString(36)}_abc123`;

    it('should return true for a database created more than an hour ago', () => {
      expect(isStaleTestDatabase(nameCreatedAt(now - 2 * HOUR_MS), now)).toBe(true);
    });

    it('should return false for a database created a minute ago', () => {
      expect(isStaleTestDatabase(nameCreatedAt(now - 60_000), now)).toBe(false);
    });

    it('should return false for a database without the test prefix', () => {
      expect(isStaleTestDatabase('postgres', now)).toBe(false);
    });

    it('should return false for the legacy support_bot_test database', () => {
      expect(isStaleTestDatabase('support_bot_test', now)).toBe(false);
    });

    it('should return false when the name has no readable timestamp', () => {
      expect(isStaleTestDatabase(`${TEST_DATABASE_PREFIX}!!!_abc`, now)).toBe(false);
    });
  });
});

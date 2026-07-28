import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env module before importing cors
vi.mock('../../config/env.js', () => ({
  env: {
    SUPPORT_DOMAIN: 'chat.dellshop.ru',
    NODE_ENV: 'production',
  },
}));

import { getBaseDomain, isOriginAllowed, getConfiguredBaseDomain, isOriginAllowedByConfig } from '../cors.js';

describe('CORS utilities', () => {
  describe('getBaseDomain', () => {
    it('should extract base domain from subdomain', () => {
      expect(getBaseDomain('chat.dellshop.ru')).toBe('dellshop.ru');
    });

    it('should extract base domain from multiple subdomains', () => {
      expect(getBaseDomain('api.staging.example.com')).toBe('example.com');
    });

    it('should return same domain if already base', () => {
      expect(getBaseDomain('dellshop.ru')).toBe('dellshop.ru');
    });

    it('should handle localhost', () => {
      expect(getBaseDomain('localhost')).toBe('localhost');
    });

    it('should strip port from hostname', () => {
      expect(getBaseDomain('localhost:3000')).toBe('localhost');
      expect(getBaseDomain('chat.dellshop.ru:443')).toBe('dellshop.ru');
    });

    it('should handle www subdomain', () => {
      expect(getBaseDomain('www.dellshop.ru')).toBe('dellshop.ru');
    });
  });

  describe('isOriginAllowed', () => {
    const baseDomain = 'dellshop.ru';

    it('should allow exact domain match', () => {
      expect(isOriginAllowed('https://dellshop.ru', baseDomain)).toBe(true);
    });

    it('should allow www subdomain', () => {
      expect(isOriginAllowed('https://www.dellshop.ru', baseDomain)).toBe(true);
    });

    it('should allow any subdomain', () => {
      expect(isOriginAllowed('https://chat.dellshop.ru', baseDomain)).toBe(true);
      expect(isOriginAllowed('https://staging.dellshop.ru', baseDomain)).toBe(true);
      expect(isOriginAllowed('https://api.chat.dellshop.ru', baseDomain)).toBe(true);
    });

    it('should reject different domain', () => {
      expect(isOriginAllowed('https://evil.com', baseDomain)).toBe(false);
      expect(isOriginAllowed('https://dellshop.com', baseDomain)).toBe(false);
    });

    it('should reject domain suffix attacks', () => {
      // evildellshop.ru should NOT match dellshop.ru
      expect(isOriginAllowed('https://evildellshop.ru', baseDomain)).toBe(false);
    });

    it('should reject undefined origin', () => {
      expect(isOriginAllowed(undefined, baseDomain)).toBe(false);
    });

    it('should reject empty origin', () => {
      expect(isOriginAllowed('', baseDomain)).toBe(false);
    });

    it('should reject invalid URL', () => {
      expect(isOriginAllowed('not-a-url', baseDomain)).toBe(false);
    });

    it('should reject empty base domain', () => {
      expect(isOriginAllowed('https://dellshop.ru', '')).toBe(false);
    });
  });

  describe('isOriginAllowed with localhost in development', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('should allow localhost in development mode', async () => {
      vi.doMock('../../config/env.js', () => ({
        env: {
          SUPPORT_DOMAIN: 'chat.dellshop.ru',
          NODE_ENV: 'development',
        },
      }));

      const { isOriginAllowed: isOriginAllowedDev } = await import('../cors.js');
      expect(isOriginAllowedDev('http://localhost:3000', 'dellshop.ru')).toBe(true);
      expect(isOriginAllowedDev('http://localhost:5173', 'dellshop.ru')).toBe(true);
    });

    it('should reject localhost in production mode', async () => {
      vi.doMock('../../config/env.js', () => ({
        env: {
          SUPPORT_DOMAIN: 'chat.dellshop.ru',
          NODE_ENV: 'production',
        },
      }));

      const { isOriginAllowed: isOriginAllowedProd } = await import('../cors.js');
      expect(isOriginAllowedProd('http://localhost:3000', 'dellshop.ru')).toBe(false);
    });
  });

  describe('getConfiguredBaseDomain', () => {
    it('should return base domain from SUPPORT_DOMAIN', () => {
      // SUPPORT_DOMAIN is mocked as 'chat.dellshop.ru'
      expect(getConfiguredBaseDomain()).toBe('dellshop.ru');
    });
  });

  describe('isOriginAllowedByConfig', () => {
    it('should allow valid origins based on SUPPORT_DOMAIN', () => {
      expect(isOriginAllowedByConfig('https://dellshop.ru')).toBe(true);
      expect(isOriginAllowedByConfig('https://www.dellshop.ru')).toBe(true);
      expect(isOriginAllowedByConfig('https://chat.dellshop.ru')).toBe(true);
    });

    it('should reject invalid origins', () => {
      expect(isOriginAllowedByConfig('https://evil.com')).toBe(false);
      expect(isOriginAllowedByConfig(undefined)).toBe(false);
    });
  });

  describe('isOriginAllowedByConfig without SUPPORT_DOMAIN', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
    });

    it('should reject all origins when SUPPORT_DOMAIN is not set', async () => {
      vi.doMock('../../config/env.js', () => ({
        env: {
          SUPPORT_DOMAIN: undefined,
          NODE_ENV: 'production',
        },
      }));

      const { isOriginAllowedByConfig: isOriginAllowedByConfigNoEnv } = await import('../cors.js');
      expect(isOriginAllowedByConfigNoEnv('https://dellshop.ru')).toBe(false);
      expect(isOriginAllowedByConfigNoEnv('https://any-domain.com')).toBe(false);
    });
  });

  describe('isOriginAllowedByConfig with ALLOWED_ORIGINS', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
    });

    async function loadWith(envOverrides: Record<string, string | undefined>) {
      vi.doMock('../../config/env.js', () => ({
        env: { NODE_ENV: 'production', ...envOverrides },
      }));
      return import('../cors.js');
    }

    it('should allow a domain from the list', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: 'beforetheygo.web.codecitadel.ru',
        ALLOWED_ORIGINS: 'dellshop.ru,example.com',
      });

      expect(check('https://dellshop.ru')).toBe(true);
      expect(check('https://example.com')).toBe(true);
    });

    it('should allow subdomains of a listed domain', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: 'beforetheygo.web.codecitadel.ru',
        ALLOWED_ORIGINS: 'dellshop.ru',
      });

      expect(check('https://www.dellshop.ru')).toBe(true);
      expect(check('https://shop.dellshop.ru')).toBe(true);
    });

    it('should still allow the base domain of SUPPORT_DOMAIN', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: 'beforetheygo.web.codecitadel.ru',
        ALLOWED_ORIGINS: 'dellshop.ru',
      });

      expect(check('https://codecitadel.ru')).toBe(true);
      expect(check('https://beforetheygo.web.codecitadel.ru')).toBe(true);
    });

    it('should reject origins outside the list', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: 'beforetheygo.web.codecitadel.ru',
        ALLOWED_ORIGINS: 'dellshop.ru',
      });

      expect(check('https://evil.com')).toBe(false);
      expect(check('https://notdellshop.ru')).toBe(false);
    });

    it('should tolerate spaces, empty entries and full origins in the list', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: ' dellshop.ru , , https://example.com/ ',
      });

      expect(check('https://dellshop.ru')).toBe(true);
      expect(check('https://example.com')).toBe(true);
      expect(check('https://evil.com')).toBe(false);
    });

    it('should work without SUPPORT_DOMAIN when the list is set', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'dellshop.ru',
      });

      expect(check('https://dellshop.ru')).toBe(true);
      expect(check('https://www.dellshop.ru')).toBe(true);
    });

    it('should enable the origin check when only ALLOWED_ORIGINS is set', async () => {
      const { isOriginCheckEnabled } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'dellshop.ru',
      });

      expect(isOriginCheckEnabled()).toBe(true);
    });

    it('should enable the origin check when only SUPPORT_DOMAIN is set', async () => {
      const { isOriginCheckEnabled } = await loadWith({
        SUPPORT_DOMAIN: 'beforetheygo.web.codecitadel.ru',
        ALLOWED_ORIGINS: undefined,
      });

      expect(isOriginCheckEnabled()).toBe(true);
    });

    it('should disable the origin check when nothing is configured', async () => {
      const { isOriginCheckEnabled } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: undefined,
      });

      expect(isOriginCheckEnabled()).toBe(false);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env module before importing cors
vi.mock('../../config/env.js', () => ({
  env: {
    SUPPORT_DOMAIN: 'chat.dellshop.ru',
    NODE_ENV: 'production',
  },
}));

vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getBaseDomain, isOriginAllowed, getConfiguredBaseDomain, isOriginAllowedByConfig } from '../cors.js';

describe('cors', () => {
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

    it('should treat a listed subdomain as itself, not as its parent domain', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'shop.dellshop.ru',
      });

      expect(check('https://shop.dellshop.ru')).toBe(true);
      expect(check('https://api.shop.dellshop.ru')).toBe(true);
      expect(check('https://dellshop.ru')).toBe(false);
      expect(check('https://www.dellshop.ru')).toBe(false);
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

  describe('isOriginAllowedByConfig with a cyrillic domain', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
    });

    // A browser always sends Origin in its ascii form, so both ways of writing
    // the domain in the settings have to lead to the same result
    const ASCII_ORIGIN = 'https://xn----1-eddldb4czbcgk3p.xn--p1ai';

    async function loadWith(envOverrides: Record<string, string | undefined>) {
      vi.doMock('../../config/env.js', () => ({
        env: { NODE_ENV: 'production', ...envOverrides },
      }));
      return import('../cors.js');
    }

    it('should allow the ascii origin for an entry written in cyrillic', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'сервер-для-1с.рф',
      });

      expect(check(ASCII_ORIGIN)).toBe(true);
      expect(check(`https://www.xn----1-eddldb4czbcgk3p.xn--p1ai`)).toBe(true);
      expect(check('https://evil.com')).toBe(false);
    });

    it('should allow the ascii origin for an entry written in ascii', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'xn----1-eddldb4czbcgk3p.xn--p1ai',
      });

      expect(check(ASCII_ORIGIN)).toBe(true);
    });

    it('should accept a full origin written in cyrillic', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: ' https://сервер-для-1с.рф/ ',
      });

      expect(check(ASCII_ORIGIN)).toBe(true);
    });

    it('should allow a cyrillic SUPPORT_DOMAIN', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: 'чат.сервер-для-1с.рф',
        ALLOWED_ORIGINS: undefined,
      });

      expect(check(ASCII_ORIGIN)).toBe(true);
    });

    it('should ignore letter case in entries', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'DellShop.RU',
      });

      expect(check('https://dellshop.ru')).toBe(true);
    });

    it('should keep an entry that is not a domain at all', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'localhost:3000,192.168.1.10',
      });

      expect(check('http://192.168.1.10')).toBe(true);
      expect(check('https://evil.com')).toBe(false);
    });
  });

  describe('isOriginAllowedByConfig with ALLOWED_ORIGINS set to *', () => {
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

    it('should allow any site', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: '*',
      });

      expect(check('https://any-site.com')).toBe(true);
      expect(check('https://shop.another-site.org')).toBe(true);
      expect(check('http://xn----1-eddldb4czbcgk3p.xn--p1ai')).toBe(true);
    });

    it('should allow any site next to listed domains', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: 'dellshop.ru, * ',
      });

      expect(check('https://any-site.com')).toBe(true);
      expect(check('https://dellshop.ru')).toBe(true);
    });

    it('should still reject a request without an Origin header', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: '*',
      });

      expect(check(undefined)).toBe(false);
      expect(check('')).toBe(false);
    });

    it('should reject an origin that is not an http address', async () => {
      const { isOriginAllowedByConfig: check } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: '*',
      });

      expect(check('not-a-url')).toBe(false);
      expect(check('file:///home/user/page.html')).toBe(false);
      expect(check('chrome-extension://abcdefghijklmnop')).toBe(false);
    });

    it('should keep the origin check enabled so websockets require an origin', async () => {
      const { isOriginCheckEnabled } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: '*',
      });

      expect(isOriginCheckEnabled()).toBe(true);
    });

    it('should not treat * as a domain of its own', async () => {
      const { getAllowedDomains } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: '*,dellshop.ru',
      });

      expect(getAllowedDomains()).toEqual(['dellshop.ru']);
    });
  });

  describe('warnAboutOriginConfig', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
    });

    afterEach(() => {
      vi.resetModules();
    });

    async function loadWith(envOverrides: Record<string, string | undefined>) {
      vi.doMock('../../config/env.js', () => ({
        env: { NODE_ENV: 'production', ...envOverrides },
      }));
      const { warnAboutOriginConfig } = await import('../cors.js');
      const { logger } = await import('../../utils/logger.js');
      return { warnAboutOriginConfig, logger };
    }

    it('should warn when an entry repeats the base domain of SUPPORT_DOMAIN', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: 'dellshop.ru',
      });

      warnAboutOriginConfig();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: 'dellshop.ru',
          supportDomain: 'chat.dellshop.ru',
          supportBaseDomain: 'dellshop.ru',
          hint: expect.stringContaining('SUPPORT_DOMAIN'),
        }),
        'ALLOWED_ORIGINS entry repeats the base domain of SUPPORT_DOMAIN',
      );
    });

    it('should warn when a listed subdomain does not cover its parent domain', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'shop.dellshop.ru',
      });

      warnAboutOriginConfig();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: 'shop.dellshop.ru',
          parentDomain: 'dellshop.ru',
          hint: expect.stringContaining('ALLOWED_ORIGINS'),
        }),
        'ALLOWED_ORIGINS entry does not allow its parent domain',
      );
    });

    it('should not warn when the parent domain is listed as well', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'shop.dellshop.ru,dellshop.ru',
      });

      warnAboutOriginConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn when the parent domain is covered by SUPPORT_DOMAIN', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: 'shop.example.dellshop.ru',
      });

      warnAboutOriginConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn about plain second-level domains', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'dellshop.ru,example.com',
      });

      warnAboutOriginConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn about a cyrillic second-level domain', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'сервер-для-1с.рф',
      });

      warnAboutOriginConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn when ALLOWED_ORIGINS is not set', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: undefined,
      });

      warnAboutOriginConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn about localhost or an IP address', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: 'localhost:3000,192.168.1.10',
      });

      warnAboutOriginConfig();

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should skip empty entries and normalize full origins before checking', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: undefined,
        ALLOWED_ORIGINS: ' , https://shop.dellshop.ru/ ',
      });

      warnAboutOriginConfig();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ entry: 'shop.dellshop.ru' }),
        'ALLOWED_ORIGINS entry does not allow its parent domain',
      );
    });

    it('should warn once per problematic entry', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: 'dellshop.ru,shop.example.com',
      });

      warnAboutOriginConfig();

      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    it('should warn that the widget accepts requests from any site', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: '*',
      });

      warnAboutOriginConfig();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ hint: expect.stringContaining('ALLOWED_ORIGINS') }),
        'ALLOWED_ORIGINS contains *: requests are accepted from any site',
      );
    });

    it('should not warn about domains listed next to *', async () => {
      const { warnAboutOriginConfig, logger } = await loadWith({
        SUPPORT_DOMAIN: 'chat.dellshop.ru',
        ALLOWED_ORIGINS: '*,dellshop.ru,shop.example.com',
      });

      warnAboutOriginConfig();

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.anything(),
        'ALLOWED_ORIGINS contains *: requests are accepted from any site',
      );
    });
  });
});

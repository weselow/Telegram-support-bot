import { describe, it, expect } from 'vitest';
import { isBot } from '../bot-filter.js';

describe('bot-filter middleware', () => {
  describe('isBot', () => {
    it('should return true for empty user agent', () => {
      expect(isBot('')).toBe(true);
      expect(isBot('   ')).toBe(true);
    });

    it('should return true for undefined user agent', () => {
      expect(isBot(undefined)).toBe(true);
    });

    it('should detect search engine bots', () => {
      expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true);
      expect(isBot('Mozilla/5.0 (compatible; Bingbot/2.0)')).toBe(true);
      expect(isBot('Mozilla/5.0 (compatible; YandexBot/3.0)')).toBe(true);
      expect(isBot('Baiduspider+(+http://www.baidu.com/search/spider.htm)')).toBe(true);
      expect(isBot('DuckDuckBot/1.0')).toBe(true);
    });

    it('should detect CLI tools', () => {
      expect(isBot('curl/7.68.0')).toBe(true);
      expect(isBot('Wget/1.20.3')).toBe(true);
      expect(isBot('python-requests/2.25.1')).toBe(true);
      expect(isBot('Python-urllib/3.8')).toBe(true);
      expect(isBot('Go-http-client/1.1')).toBe(true);
      expect(isBot('Java/11.0.2')).toBe(true);
      expect(isBot('okhttp/4.9.0')).toBe(true);
    });

    it('should detect headless browsers', () => {
      expect(isBot('Mozilla/5.0 HeadlessChrome/91.0.4472.124')).toBe(true);
      expect(isBot('PhantomJS/2.1.1')).toBe(true);
      expect(isBot('Mozilla/5.0 puppeteer')).toBe(true);
      expect(isBot('Mozilla/5.0 playwright')).toBe(true);
    });

    it('should detect generic bot patterns', () => {
      expect(isBot('SomeBot/1.0')).toBe(true);
      expect(isBot('WebSpider/1.0')).toBe(true);
      expect(isBot('MyCrawler/1.0')).toBe(true);
      expect(isBot('DataScraper/1.0')).toBe(true);
    });

    it('should allow legitimate browsers', () => {
      // Chrome
      expect(
        isBot(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        )
      ).toBe(false);

      // Firefox
      expect(
        isBot(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
        )
      ).toBe(false);

      // Safari
      expect(
        isBot(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
        )
      ).toBe(false);

      // Mobile Chrome
      expect(
        isBot(
          'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
        )
      ).toBe(false);

      // Edge
      expect(
        isBot(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
        )
      ).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isBot('GOOGLEBOT/2.1')).toBe(true);
      expect(isBot('CURL/7.68.0')).toBe(true);
      expect(isBot('BOT')).toBe(true);
    });
  });
});

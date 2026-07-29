import { describe, it, expect } from 'vitest';
import { resolvePageUrl } from '../page-url.js';

describe('page-url', () => {
  describe('resolvePageUrl', () => {
    it('should return page url from body when its origin matches the Origin header', () => {
      const result = resolvePageUrl(
        'https://shop.example.com/catalog/item-42?utm=ya',
        'https://shop.example.com',
        'https://shop.example.com/'
      );

      expect(result).toBe('https://shop.example.com/catalog/item-42?utm=ya');
    });

    it('should fall back to referer when page url comes from another origin', () => {
      const result = resolvePageUrl(
        'https://evil.com/phishing',
        'https://shop.example.com',
        'https://shop.example.com/'
      );

      expect(result).toBe('https://shop.example.com/');
    });

    it('should fall back to referer when page url is missing', () => {
      const result = resolvePageUrl(undefined, 'https://shop.example.com', 'https://shop.example.com/');

      expect(result).toBe('https://shop.example.com/');
    });

    it('should fall back to referer when page url is not a valid url', () => {
      const result = resolvePageUrl('not a url', 'https://shop.example.com', 'https://shop.example.com/');

      expect(result).toBe('https://shop.example.com/');
    });

    it('should fall back to referer when Origin header is missing', () => {
      const result = resolvePageUrl(
        'https://shop.example.com/catalog/item-42',
        undefined,
        'https://shop.example.com/catalog/item-42'
      );

      expect(result).toBe('https://shop.example.com/catalog/item-42');
    });

    it('should reject page url with a non-http scheme', () => {
      const result = resolvePageUrl(
        'javascript:alert(1)',
        'https://shop.example.com',
        'https://shop.example.com/'
      );

      expect(result).toBe('https://shop.example.com/');
    });

    it('should reject page url longer than the limit', () => {
      const longUrl = `https://shop.example.com/${'a'.repeat(2000)}`;

      const result = resolvePageUrl(longUrl, 'https://shop.example.com', 'https://shop.example.com/');

      expect(result).toBe('https://shop.example.com/');
    });

    it('should ignore a page url that is not a string', () => {
      const result = resolvePageUrl(42 as unknown as string, 'https://shop.example.com', undefined);

      expect(result).toBeUndefined();
    });

    it('should return undefined when nothing is known about the page', () => {
      const result = resolvePageUrl(undefined, undefined, undefined);

      expect(result).toBeUndefined();
    });
  });
});

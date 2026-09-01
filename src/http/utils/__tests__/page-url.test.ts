import { describe, it, expect } from 'vitest';
import { resolvePageUrl, resolveClickedPageUrl } from '../page-url.js';

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

  describe('resolveClickedPageUrl', () => {
    it('should return the page url when its origin matches the truncated referer', () => {
      const result = resolveClickedPageUrl(
        'https://shop.example.com/catalog/item-42?utm=ya',
        'https://shop.example.com/'
      );

      expect(result).toBe('https://shop.example.com/catalog/item-42?utm=ya');
    });

    it('should fall back to referer when the page url points at another site', () => {
      // Единственная защита здесь: чужую ссылку в поле «Источник» не подложить
      const result = resolveClickedPageUrl(
        'https://evil.test/looks-like-a-bank',
        'https://shop.example.com/'
      );

      expect(result).toBe('https://shop.example.com/');
    });

    it('should fall back to referer when the parameter is missing', () => {
      const result = resolveClickedPageUrl(undefined, 'https://shop.example.com/');

      expect(result).toBe('https://shop.example.com/');
    });

    it('should accept a page url matching a full same-site referer', () => {
      // Ссылка стоит на самом домене поддержки — браузер Referer не укорачивает
      const result = resolveClickedPageUrl(
        'https://support.example.com/help/faq',
        'https://support.example.com/help/faq'
      );

      expect(result).toBe('https://support.example.com/help/faq');
    });

    it('should drop the page url when there is no referer to compare with', () => {
      const result = resolveClickedPageUrl('https://shop.example.com/catalog/item-42', undefined);

      expect(result).toBeUndefined();
    });

    it('should reject a page url with a non-http scheme', () => {
      const result = resolveClickedPageUrl('javascript:alert(1)', 'https://shop.example.com/');

      expect(result).toBe('https://shop.example.com/');
    });

    it('should reject a page url longer than the limit', () => {
      const longUrl = `https://shop.example.com/${'a'.repeat(2000)}`;

      const result = resolveClickedPageUrl(longUrl, 'https://shop.example.com/');

      expect(result).toBe('https://shop.example.com/');
    });

    it('should ignore a repeated parameter arriving as an array', () => {
      const result = resolveClickedPageUrl(
        ['https://shop.example.com/a', 'https://shop.example.com/b'] as unknown as string,
        'https://shop.example.com/'
      );

      expect(result).toBe('https://shop.example.com/');
    });

    it('should ignore a broken referer', () => {
      const result = resolveClickedPageUrl('https://shop.example.com/catalog', 'not a url');

      expect(result).toBe('not a url');
    });
  });
});

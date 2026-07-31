import { describe, it, expect } from 'vitest';

import { toDisplayUrl } from '../display-url.js';

describe('display-url', () => {
  describe('toDisplayUrl', () => {
    it('should show a cyrillic domain instead of its ascii form', () => {
      expect(toDisplayUrl('https://xn----1-eddldb4czbcgk3p.xn--p1ai/')).toBe(
        'https://сервер-для-1с.рф/'
      );
    });

    it('should show a cyrillic subdomain instead of its ascii form', () => {
      expect(toDisplayUrl('https://www.xn----1-eddldb4czbcgk3p.xn--p1ai/price')).toBe(
        'https://www.сервер-для-1с.рф/price'
      );
    });

    it('should decode a percent encoded path', () => {
      expect(
        toDisplayUrl('https://xn----1-eddldb4czbcgk3p.xn--p1ai/%D1%83%D1%81%D0%BB%D1%83%D0%B3%D0%B8/')
      ).toBe('https://сервер-для-1с.рф/услуги/');
    });

    it('should keep query and hash', () => {
      expect(toDisplayUrl('https://xn----1-eddldb4czbcgk3p.xn--p1ai/search?q=1c&page=2#top')).toBe(
        'https://сервер-для-1с.рф/search?q=1c&page=2#top'
      );
    });

    it('should keep a port', () => {
      expect(toDisplayUrl('https://xn----1-eddldb4czbcgk3p.xn--p1ai:8443/')).toBe(
        'https://сервер-для-1с.рф:8443/'
      );
    });

    it('should leave a plain ascii url unchanged', () => {
      expect(toDisplayUrl('https://shop.example.com/catalog/dell_poweredge_r740')).toBe(
        'https://shop.example.com/catalog/dell_poweredge_r740'
      );
    });

    it('should keep percent encoding when decoding would break the link with a space', () => {
      expect(toDisplayUrl('https://example.com/my%20page')).toBe('https://example.com/my%20page');
    });

    it('should survive a broken percent sequence', () => {
      expect(toDisplayUrl('https://example.com/%zz')).toBe('https://example.com/%zz');
    });

    it('should return an unparseable address as is', () => {
      expect(toDisplayUrl('not-a-url')).toBe('not-a-url');
      expect(toDisplayUrl('')).toBe('');
    });

    it('should not keep credentials from the address', () => {
      expect(toDisplayUrl('https://user:secret@example.com/page')).toBe('https://example.com/page');
    });
  });
});

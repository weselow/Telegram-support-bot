import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../telegram-html.js';

describe('telegram-html', () => {
  describe('escapeHtml', () => {
    it('should escape the three characters telegram treats as markup', () => {
      expect(escapeHtml('<b>bold</b> & more')).toBe('&lt;b&gt;bold&lt;/b&gt; &amp; more');
    });

    it('should escape the ampersand before the angle brackets', () => {
      // Обратный порядок замен превратил бы «<» сначала в «&lt;», а потом его
      // же собственный «&» — в «&amp;lt;», и получатель увидел бы entity
      expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
    });

    it('should not double-escape an entity written by hand', () => {
      expect(escapeHtml('&lt;')).toBe('&amp;lt;');
    });

    it('should leave markdown characters untouched', () => {
      expect(escapeHtml('Иван _*[]() шеф')).toBe('Иван _*[]() шеф');
    });

    it('should return an empty string unchanged', () => {
      expect(escapeHtml('')).toBe('');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  getFileCategory,
  isAllowedMimeType,
  getMaxFileSize,
  validateFile,
  sanitizeFilename,
} from '../file-validation.js';

describe('file-validation', () => {
  describe('getFileCategory', () => {
    it('should return "image" for image MIME types', () => {
      expect(getFileCategory('image/jpeg')).toBe('image');
      expect(getFileCategory('image/png')).toBe('image');
      expect(getFileCategory('image/gif')).toBe('image');
      expect(getFileCategory('image/webp')).toBe('image');
      expect(getFileCategory('image/heic')).toBe('image');
      expect(getFileCategory('image/heif')).toBe('image');
      expect(getFileCategory('image/bmp')).toBe('image');
    });

    it('should return "document" for document MIME types', () => {
      expect(getFileCategory('application/pdf')).toBe('document');
      expect(getFileCategory('application/msword')).toBe('document');
      expect(getFileCategory('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('document');
      expect(getFileCategory('application/vnd.ms-excel')).toBe('document');
      expect(getFileCategory('text/plain')).toBe('document');
      expect(getFileCategory('text/csv')).toBe('document');
    });

    it('should return "document" for archive MIME types', () => {
      expect(getFileCategory('application/zip')).toBe('document');
      expect(getFileCategory('application/x-rar-compressed')).toBe('document');
      expect(getFileCategory('application/x-7z-compressed')).toBe('document');
    });

    it('should return null for unsupported MIME types', () => {
      expect(getFileCategory('application/javascript')).toBeNull();
      expect(getFileCategory('text/html')).toBeNull();
      expect(getFileCategory('video/mp4')).toBeNull();
      expect(getFileCategory('audio/mpeg')).toBeNull();
      expect(getFileCategory('')).toBeNull();
    });
  });

  describe('isAllowedMimeType', () => {
    it('should return true for allowed types', () => {
      expect(isAllowedMimeType('image/jpeg')).toBe(true);
      expect(isAllowedMimeType('application/pdf')).toBe(true);
      expect(isAllowedMimeType('application/zip')).toBe(true);
    });

    it('should return false for disallowed types', () => {
      expect(isAllowedMimeType('application/javascript')).toBe(false);
      expect(isAllowedMimeType('text/html')).toBe(false);
      expect(isAllowedMimeType('application/x-executable')).toBe(false);
    });
  });

  describe('getMaxFileSize', () => {
    it('should return 10MB for images', () => {
      const tenMB = 10 * 1024 * 1024;
      expect(getMaxFileSize('image/jpeg')).toBe(tenMB);
      expect(getMaxFileSize('image/png')).toBe(tenMB);
      expect(getMaxFileSize('image/gif')).toBe(tenMB);
    });

    it('should return 20MB for documents', () => {
      const twentyMB = 20 * 1024 * 1024;
      expect(getMaxFileSize('application/pdf')).toBe(twentyMB);
      expect(getMaxFileSize('application/zip')).toBe(twentyMB);
      expect(getMaxFileSize('text/plain')).toBe(twentyMB);
    });

    it('should return 20MB for unknown types (default)', () => {
      const twentyMB = 20 * 1024 * 1024;
      expect(getMaxFileSize('unknown/type')).toBe(twentyMB);
    });
  });

  describe('validateFile', () => {
    it('should return valid for allowed image within size limit', () => {
      const result = validateFile('image/jpeg', 5 * 1024 * 1024); // 5MB
      expect(result).toEqual({ valid: true, category: 'image' });
    });

    it('should return valid for allowed document within size limit', () => {
      const result = validateFile('application/pdf', 15 * 1024 * 1024); // 15MB
      expect(result).toEqual({ valid: true, category: 'document' });
    });

    it('should return valid for file exactly at size limit', () => {
      const result = validateFile('image/png', 10 * 1024 * 1024); // exactly 10MB
      expect(result).toEqual({ valid: true, category: 'image' });
    });

    it('should return error for unsupported MIME type', () => {
      const result = validateFile('application/javascript', 1024);
      expect(result).toEqual({
        valid: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Этот тип файла не поддерживается',
        },
      });
    });

    it('should return error for image exceeding size limit', () => {
      const result = validateFile('image/jpeg', 11 * 1024 * 1024); // 11MB
      expect(result).toEqual({
        valid: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Файл слишком большой. Максимум: 10 МБ',
        },
      });
    });

    it('should return error for document exceeding size limit', () => {
      const result = validateFile('application/pdf', 21 * 1024 * 1024); // 21MB
      expect(result).toEqual({
        valid: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Файл слишком большой. Максимум: 20 МБ',
        },
      });
    });
  });

  describe('sanitizeFilename', () => {
    it('should preserve safe filenames', () => {
      expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
      expect(sanitizeFilename('my-file_2024.txt')).toBe('my-file_2024.txt');
      expect(sanitizeFilename('photo (1).jpg')).toBe('photo (1).jpg');
    });

    it('should replace path traversal attempts', () => {
      // Multiple dots get compressed to single dot after slash replacement
      // ../ becomes _. then leading dot removed, but the pattern is complex
      expect(sanitizeFilename('../../../etc/passwd')).toBe('_._._etc_passwd');
      // ..\\ becomes _._ pattern
      expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('_._windows_system32');
    });

    it('should replace Windows forbidden characters', () => {
      expect(sanitizeFilename('file<test>.txt')).toBe('file_test_.txt');
      expect(sanitizeFilename('test:file.doc')).toBe('test_file.doc');
      expect(sanitizeFilename('file"name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFilename('test|pipe.txt')).toBe('test_pipe.txt');
      expect(sanitizeFilename('what?.txt')).toBe('what_.txt');
      expect(sanitizeFilename('star*.txt')).toBe('star_.txt');
    });

    it('should handle multiple consecutive dots', () => {
      expect(sanitizeFilename('file...exe')).toBe('file.exe');
      expect(sanitizeFilename('test....pdf')).toBe('test.pdf');
    });

    it('should remove leading dots', () => {
      expect(sanitizeFilename('.hidden')).toBe('hidden');
      expect(sanitizeFilename('...hidden')).toBe('hidden');
      expect(sanitizeFilename('.hidden.txt')).toBe('hidden.txt');
    });

    it('should remove trailing dots', () => {
      expect(sanitizeFilename('file.')).toBe('file');
      expect(sanitizeFilename('file...')).toBe('file');
    });

    it('should remove control characters', () => {
      expect(sanitizeFilename('file\x00name.txt')).toBe('file_name.txt');
      expect(sanitizeFilename('test\x1ffile.doc')).toBe('test_file.doc');
    });

    it('should truncate long filenames to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBe(255);
    });

    it('should trim whitespace', () => {
      expect(sanitizeFilename('  file.txt  ')).toBe('file.txt');
      // Tab and newline are control characters, replaced with underscores
      expect(sanitizeFilename('\ttest.pdf\n')).toBe('_test.pdf_');
    });

    it('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('');
    });

    it('should handle string with only dots', () => {
      expect(sanitizeFilename('...')).toBe('');
      expect(sanitizeFilename('.')).toBe('');
    });
  });
});

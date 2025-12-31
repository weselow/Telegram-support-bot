/**
 * File validation utilities for web chat uploads
 */

// Image MIME types - max 10 MB
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
]);

// Document MIME types - max 20 MB
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'application/rtf',
]);

// Archive MIME types - max 20 MB
const ARCHIVE_MIME_TYPES = new Set([
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
]);

// Size limits in bytes
const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const DOCUMENT_MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export type FileCategory = 'image' | 'document';

export interface FileValidationResult {
  valid: boolean;
  category?: FileCategory;
  error?: {
    code: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE';
    message: string;
  };
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory | null {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return 'image';
  }
  if (DOCUMENT_MIME_TYPES.has(mimeType) || ARCHIVE_MIME_TYPES.has(mimeType)) {
    return 'document';
  }
  return null;
}

/**
 * Check if MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return getFileCategory(mimeType) !== null;
}

/**
 * Get max file size for a MIME type
 */
export function getMaxFileSize(mimeType: string): number {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return IMAGE_MAX_SIZE;
  }
  return DOCUMENT_MAX_SIZE;
}

/**
 * Validate file for upload
 */
export function validateFile(mimeType: string, fileSize: number): FileValidationResult {
  const category = getFileCategory(mimeType);

  if (!category) {
    return {
      valid: false,
      error: {
        code: 'INVALID_FILE_TYPE',
        message: 'Этот тип файла не поддерживается',
      },
    };
  }

  const maxSize = getMaxFileSize(mimeType);
  if (fileSize > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `Файл слишком большой. Максимум: ${String(maxSizeMB)} МБ`,
      },
    };
  }

  return { valid: true, category };
}

/**
 * Sanitize filename - remove dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  // Remove path traversal and dangerous characters
  return filename
    // eslint-disable-next-line no-control-regex -- intentional control character removal for security
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Windows forbidden chars + control chars
    .replace(/\.{2,}/g, '.') // Multiple dots
    .replace(/^\.+/, '') // Leading dots
    .replace(/\.+$/, '') // Trailing dots
    .trim()
    .slice(0, 255); // Max filename length
}

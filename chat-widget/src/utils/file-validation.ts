/**
 * File validation utilities for chat widget
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
])

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
])

// Archive MIME types - max 20 MB
const ARCHIVE_MIME_TYPES = new Set([
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
])

// Size limits in bytes
const IMAGE_MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const DOCUMENT_MAX_SIZE = 20 * 1024 * 1024 // 20 MB

export type FileCategory = 'image' | 'document'

export interface FileValidationResult {
  valid: boolean
  category?: FileCategory
  error?: string
}

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): FileCategory | null {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return 'image'
  }
  if (DOCUMENT_MIME_TYPES.has(mimeType) || ARCHIVE_MIME_TYPES.has(mimeType)) {
    return 'document'
  }
  return null
}

/**
 * Check if file is an image
 */
export function isImage(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType)
}

/**
 * Get max file size for a MIME type
 */
export function getMaxFileSize(mimeType: string): number {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return IMAGE_MAX_SIZE
  }
  return DOCUMENT_MAX_SIZE
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} КБ`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/**
 * Validate file for upload
 */
export function validateFile(file: File): FileValidationResult {
  const category = getFileCategory(file.type)

  if (!category) {
    return {
      valid: false,
      error: 'Этот тип файла не поддерживается'
    }
  }

  const maxSize = getMaxFileSize(file.type)
  if (file.size > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024)
    return {
      valid: false,
      error: `Файл слишком большой. Максимум: ${maxSizeMB} МБ`
    }
  }

  return { valid: true, category }
}

/**
 * Get accept attribute for file input
 */
export function getAcceptAttribute(): string {
  const types = [
    ...IMAGE_MIME_TYPES,
    ...DOCUMENT_MIME_TYPES,
    ...ARCHIVE_MIME_TYPES
  ]
  return types.join(',')
}

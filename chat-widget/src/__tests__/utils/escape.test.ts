import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  escapeHtml,
  sanitizeInput,
  formatMessageText,
  formatTime,
  formatDate
} from '../../utils/escape'

describe('escapeHtml', () => {
  describe('XSS attack vectors', () => {
    it('should escape script tags', () => {
      const malicious = '<script>alert("xss")</script>'
      const result = escapeHtml(malicious)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('</script>')
      expect(result).toContain('&lt;script&gt;')
    })

    it('should escape inline event handlers', () => {
      const malicious = '<img src="x" onerror="alert(\'xss\')">'
      const result = escapeHtml(malicious)
      // Tag is escaped, making onerror harmless plain text
      expect(result).toContain('&lt;img')
      expect(result).toContain('&gt;')
      expect(result).not.toContain('<img')
    })

    it('should escape onclick attributes', () => {
      const malicious = '<div onclick="alert(\'xss\')">click me</div>'
      const result = escapeHtml(malicious)
      // Tag is escaped, making onclick harmless plain text
      expect(result).toContain('&lt;div')
      expect(result).not.toContain('<div')
    })

    it('should escape svg onload', () => {
      const malicious = '<svg onload="alert(\'xss\')">'
      const result = escapeHtml(malicious)
      expect(result).not.toContain('<svg')
      expect(result).toContain('&lt;svg')
    })

    it('should escape javascript: protocol in href', () => {
      const malicious = '<a href="javascript:alert(\'xss\')">link</a>'
      const result = escapeHtml(malicious)
      // Tag is escaped, making javascript: protocol harmless plain text
      expect(result).toContain('&lt;a')
      expect(result).not.toContain('<a href')
    })

    it('should escape iframe injection', () => {
      const malicious = '<iframe src="evil.com"></iframe>'
      const result = escapeHtml(malicious)
      expect(result).not.toContain('<iframe')
      expect(result).toContain('&lt;iframe')
    })

    it('should escape style tag with expressions', () => {
      const malicious = '<style>body{background:url("javascript:alert(1)")}</style>'
      const result = escapeHtml(malicious)
      expect(result).not.toContain('<style>')
      expect(result).toContain('&lt;style&gt;')
    })
  })

  describe('normal text', () => {
    it('should pass through normal text unchanged', () => {
      const text = 'Hello, world!'
      expect(escapeHtml(text)).toBe(text)
    })

    it('should preserve spaces', () => {
      const text = 'Hello   world'
      expect(escapeHtml(text)).toBe(text)
    })

    it('should handle empty string', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should handle unicode characters', () => {
      const text = 'Привет мир 🚀'
      expect(escapeHtml(text)).toBe(text)
    })

    it('should escape ampersands', () => {
      const text = 'Tom & Jerry'
      expect(escapeHtml(text)).toBe('Tom &amp; Jerry')
    })

    it('should escape angle brackets', () => {
      const text = '5 < 10 > 3'
      const result = escapeHtml(text)
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
    })

    it('should preserve quotes in plain text', () => {
      // Quotes don't need escaping in text content (only in attributes)
      const text = 'She said "hello"'
      expect(escapeHtml(text)).toBe('She said "hello"')
    })
  })
})

describe('sanitizeInput', () => {
  describe('whitespace normalization', () => {
    it('should trim leading and trailing whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello')
    })

    it('should normalize multiple spaces to single', () => {
      expect(sanitizeInput('hello    world')).toBe('hello world')
    })

    it('should normalize tabs and newlines to single space', () => {
      expect(sanitizeInput('hello\t\n\rworld')).toBe('hello world')
    })

    it('should handle mixed whitespace', () => {
      expect(sanitizeInput('  hello  \t  world  ')).toBe('hello world')
    })
  })

  describe('length limiting', () => {
    it('should truncate text longer than 4000 chars', () => {
      const longText = 'a'.repeat(5000)
      const result = sanitizeInput(longText)
      expect(result.length).toBe(4000)
    })

    it('should not truncate text shorter than 4000 chars', () => {
      const text = 'hello world'
      expect(sanitizeInput(text)).toBe(text)
    })

    it('should handle exactly 4000 chars', () => {
      const text = 'a'.repeat(4000)
      expect(sanitizeInput(text).length).toBe(4000)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizeInput('')).toBe('')
    })

    it('should handle only whitespace', () => {
      expect(sanitizeInput('   ')).toBe('')
    })
  })
})

describe('formatMessageText', () => {
  describe('URL conversion', () => {
    it('should convert http URLs to links', () => {
      const text = 'Check http://example.com'
      const result = formatMessageText(text)
      expect(result).toContain('<a href="http://example.com"')
      expect(result).toContain('target="_blank"')
      expect(result).toContain('rel="noopener noreferrer"')
    })

    it('should convert https URLs to links', () => {
      const text = 'Check https://secure.example.com/path?query=1'
      const result = formatMessageText(text)
      expect(result).toContain('<a href="https://secure.example.com/path?query=1"')
    })

    it('should handle multiple URLs', () => {
      const text = 'Visit http://first.com and https://second.com'
      const result = formatMessageText(text)
      expect(result).toContain('href="http://first.com"')
      expect(result).toContain('href="https://second.com"')
    })

    it('should not convert non-URLs', () => {
      const text = 'Not a URL: ftp://example.com'
      const result = formatMessageText(text)
      expect(result).not.toContain('<a href="ftp://')
    })
  })

  describe('line breaks', () => {
    it('should convert newlines to br tags', () => {
      const text = 'Line 1\nLine 2'
      const result = formatMessageText(text)
      expect(result).toContain('<br>')
    })

    it('should handle multiple newlines', () => {
      const text = 'Line 1\n\nLine 3'
      const result = formatMessageText(text)
      expect(result).toContain('<br><br>')
    })
  })

  describe('XSS protection in formatted text', () => {
    it('should escape HTML before formatting', () => {
      const text = '<script>alert("xss")</script>\nhttps://example.com'
      const result = formatMessageText(text)
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;script&gt;')
      expect(result).toContain('<a href="https://example.com"')
    })

    it('should escape malicious URLs with HTML', () => {
      const text = 'https://example.com/<script>alert(1)</script>'
      const result = formatMessageText(text)
      expect(result).not.toContain('<script>')
    })
  })
})

describe('formatTime', () => {
  it('should format valid ISO string', () => {
    const result = formatTime('2025-12-30T14:30:00.000Z')
    // Result depends on timezone, just check it's not empty
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should return empty string for invalid date', () => {
    expect(formatTime('invalid-date')).toBe('')
  })

  it('should return empty string for empty input', () => {
    expect(formatTime('')).toBe('')
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should return "Сегодня" for today', () => {
    const now = new Date('2025-12-30T12:00:00.000Z')
    vi.setSystemTime(now)

    const result = formatDate('2025-12-30T10:00:00.000Z')
    expect(result).toBe('Сегодня')
  })

  it('should return "Вчера" for yesterday', () => {
    const now = new Date('2025-12-30T12:00:00.000Z')
    vi.setSystemTime(now)

    const result = formatDate('2025-12-29T10:00:00.000Z')
    expect(result).toBe('Вчера')
  })

  it('should return formatted date for older dates', () => {
    const now = new Date('2025-12-30T12:00:00.000Z')
    vi.setSystemTime(now)

    const result = formatDate('2025-12-15T10:00:00.000Z')
    // Should contain day and month in Russian
    expect(result).toMatch(/\d+\s+\S+/)
  })

  it('should return empty string for invalid date', () => {
    expect(formatDate('invalid-date')).toBe('')
  })

  it('should return empty string for empty input', () => {
    expect(formatDate('')).toBe('')
  })
})

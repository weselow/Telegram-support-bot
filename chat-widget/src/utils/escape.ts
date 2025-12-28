/**
 * XSS protection utilities
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Sanitize user input
 */
export function sanitizeInput(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .substring(0, 4000)     // Max length from API
}

/**
 * Format message text with basic formatting
 * - Convert URLs to links
 * - Preserve line breaks
 */
export function formatMessageText(text: string): string {
  // First escape HTML
  let formatted = escapeHtml(text)

  // Convert URLs to links
  const urlRegex = /(https?:\/\/[^\s<]+)/g
  formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')

  // Convert line breaks
  formatted = formatted.replace(/\n/g, '<br>')

  return formatted
}

/**
 * Format timestamp for display
 */
export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString)
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}

/**
 * Format date for message grouping
 */
export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера'
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      })
    }
  } catch {
    return ''
  }
}

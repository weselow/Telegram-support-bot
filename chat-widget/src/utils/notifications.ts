/**
 * Browser Notifications utility
 */

/**
 * Check if browser notifications are supported
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window
}

/**
 * Check current notification permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported'
  }
  return Notification.permission
}

/**
 * Request permission for browser notifications
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  } catch {
    return false
  }
}

/**
 * Show browser notification
 */
export function showNotification(
  title: string,
  body: string,
  options?: {
    icon?: string
    onClick?: () => void
    autoClose?: number
  }
): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: options?.icon,
      tag: 'dellshop-chat',
      requireInteraction: false
    })

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus()
        options.onClick?.()
        notification.close()
      }
    }

    // Auto-close after specified time (default 5 seconds)
    const autoClose = options?.autoClose ?? 5000
    if (autoClose > 0) {
      setTimeout(() => notification.close(), autoClose)
    }

    return notification
  } catch {
    return null
  }
}

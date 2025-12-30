/**
 * Lightweight error logger for chat widget
 * Batches errors and sends to backend endpoint
 */

export type ErrorLevel = 'error' | 'warn'

export interface ErrorContext {
  sessionId?: string
  code?: number | string
  reason?: string
  endpoint?: string
  [key: string]: unknown
}

interface QueuedError {
  level: ErrorLevel
  message: string
  context: {
    sessionId?: string
    userAgent: string
    url: string
    timestamp: string
  }
  stack?: string
}

interface ErrorLoggerConfig {
  apiUrl: string
  batchIntervalMs?: number
  maxErrorsPerMinute?: number
  maxQueueSize?: number
}

const DEFAULT_CONFIG = {
  batchIntervalMs: 5000,
  maxErrorsPerMinute: 10,
  maxQueueSize: 50
}

class ErrorLogger {
  private config: Required<ErrorLoggerConfig>
  private queue: QueuedError[] = []
  private errorTimestamps: number[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private sessionId: string | null = null
  private initialized = false
  private globalErrorHandler: ((event: ErrorEvent) => void) | null = null
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null

  constructor() {
    this.config = {
      apiUrl: '',
      ...DEFAULT_CONFIG
    }
  }

  /**
   * Initialize error logger with API URL
   */
  init(config: ErrorLoggerConfig): void {
    if (this.initialized) return

    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    }

    this.setupGlobalHandlers()
    this.initialized = true
  }

  /**
   * Set session ID for context
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId
  }

  /**
   * Log an error
   */
  logError(error: Error | string, context?: ErrorContext): void {
    const message = typeof error === 'string' ? error : error.message
    const stack = typeof error === 'object' ? error.stack : undefined

    this.addToQueue('error', message, context, stack)
  }

  /**
   * Log a warning
   */
  logWarning(message: string, context?: ErrorContext): void {
    this.addToQueue('warn', message, context)
  }

  /**
   * Cleanup and stop logger
   */
  destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    // Flush remaining errors
    if (this.queue.length > 0) {
      this.flush()
    }

    // Remove global handlers
    if (this.globalErrorHandler) {
      window.removeEventListener('error', this.globalErrorHandler)
      this.globalErrorHandler = null
    }
    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler)
      this.rejectionHandler = null
    }

    this.initialized = false
  }

  private setupGlobalHandlers(): void {
    // Global error handler
    this.globalErrorHandler = (event: ErrorEvent) => {
      // Ignore cross-origin script errors (no useful info)
      if (event.message === 'Script error.') return

      this.logError(event.error || event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      })
    }
    window.addEventListener('error', this.globalErrorHandler)

    // Unhandled promise rejection handler
    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      const stack = reason instanceof Error ? reason.stack : undefined

      this.addToQueue('error', `Unhandled rejection: ${message}`, undefined, stack)
    }
    window.addEventListener('unhandledrejection', this.rejectionHandler)
  }

  private addToQueue(
    level: ErrorLevel,
    message: string,
    context?: ErrorContext,
    stack?: string
  ): void {
    if (!this.initialized) return

    // Rate limiting check
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    this.errorTimestamps = this.errorTimestamps.filter(t => t > oneMinuteAgo)

    if (this.errorTimestamps.length >= this.config.maxErrorsPerMinute) {
      console.warn('[ChatWidget] Error rate limit exceeded, dropping error')
      return
    }

    this.errorTimestamps.push(now)

    // Build queued error
    const queuedError: QueuedError = {
      level,
      message,
      context: {
        sessionId: context?.sessionId || this.sessionId || undefined,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        ...this.filterContext(context)
      },
      stack
    }

    // Add to queue (with size limit)
    if (this.queue.length < this.config.maxQueueSize) {
      this.queue.push(queuedError)
    }

    // Schedule flush
    this.scheduleBatch()
  }

  // Keys that may contain sensitive data
  private static readonly SENSITIVE_KEYS = [
    'password', 'token', 'apikey', 'secret', 'auth', 'credential', 'bearer'
  ]

  private filterContext(context?: ErrorContext): Record<string, unknown> {
    if (!context) return {}

    // Extract only safe primitive values, excluding sensitive keys
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(context)) {
      if (key === 'sessionId') continue // Handled separately

      // Skip sensitive keys
      const lowerKey = key.toLowerCase()
      if (ErrorLogger.SENSITIVE_KEYS.some(s => lowerKey.includes(s))) continue

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value
      }
    }
    return result
  }

  private scheduleBatch(): void {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null
      this.flush()
    }, this.config.batchIntervalMs)
  }

  private flush(): void {
    if (this.queue.length === 0) return

    const errors = [...this.queue]
    this.queue = []

    // Send to backend (fire and forget)
    this.sendErrors(errors).catch(() => {
      // Silently ignore send failures
    })
  }

  private async sendErrors(errors: QueuedError[]): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/api/widget/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ errors })
      })
    } catch {
      // Silently ignore network errors
    }
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger()

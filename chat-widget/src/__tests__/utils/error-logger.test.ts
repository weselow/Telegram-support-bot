import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create a fresh module for each test
let errorLoggerModule: typeof import('../../utils/error-logger')

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock window.addEventListener/removeEventListener
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()
vi.stubGlobal('addEventListener', mockAddEventListener)
vi.stubGlobal('removeEventListener', mockRemoveEventListener)

describe('ErrorLogger', () => {
  beforeEach(async () => {
    // Reset mocks
    mockFetch.mockReset()
    mockAddEventListener.mockReset()
    mockRemoveEventListener.mockReset()

    // Reset module to get fresh singleton
    vi.resetModules()
    errorLoggerModule = await import('../../utils/error-logger')
  })

  afterEach(() => {
    // Cleanup
    try {
      errorLoggerModule.errorLogger.destroy()
    } catch {
      // Ignore
    }
    vi.clearAllMocks()
  })

  describe('init', () => {
    it('should initialize with config', () => {
      const { errorLogger } = errorLoggerModule

      errorLogger.init({ apiUrl: 'https://api.example.com' })

      // Should set up global handlers
      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    })

    it('should only initialize once', () => {
      const { errorLogger } = errorLoggerModule

      errorLogger.init({ apiUrl: 'https://api.example.com' })
      errorLogger.init({ apiUrl: 'https://different.com' })

      // Should only add handlers once
      expect(mockAddEventListener).toHaveBeenCalledTimes(2) // error + unhandledrejection
    })
  })

  describe('logError', () => {
    it('should not log if not initialized', async () => {
      const { errorLogger } = errorLoggerModule

      errorLogger.logError('Test error')

      // Wait for potential batch
      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should batch errors and send after interval', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      errorLogger.logError('Test error 1')
      errorLogger.logError('Test error 2')

      // Wait for batch to send
      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/widget/errors',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
      )

      // Check body contains both errors
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors).toHaveLength(2)
      expect(body.errors[0].message).toBe('Test error 1')
      expect(body.errors[1].message).toBe('Test error 2')
    })

    it('should include Error stack trace', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      const error = new Error('Test error with stack')
      errorLogger.logError(error)

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].stack).toBeDefined()
      expect(body.errors[0].stack).toContain('Error: Test error with stack')
    })

    it('should include session ID in context', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })
      errorLogger.setSessionId('test-session-123')
      errorLogger.logError('Test error')

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].context.sessionId).toBe('test-session-123')
    })
  })

  describe('logWarning', () => {
    it('should log warning with correct level', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      errorLogger.logWarning('Test warning', { code: 1006 })

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].level).toBe('warn')
      expect(body.errors[0].message).toBe('Test warning')
    })
  })

  describe('rate limiting', () => {
    it('should drop errors when rate limit exceeded', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50,
        maxErrorsPerMinute: 3
      })

      // Log more than limit
      errorLogger.logError('Error 1')
      errorLogger.logError('Error 2')
      errorLogger.logError('Error 3')
      errorLogger.logError('Error 4') // Should be dropped
      errorLogger.logError('Error 5') // Should be dropped

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors).toHaveLength(3)
    })
  })

  describe('destroy', () => {
    it('should remove global handlers', () => {
      const { errorLogger } = errorLoggerModule

      errorLogger.init({ apiUrl: 'https://api.example.com' })
      errorLogger.destroy()

      expect(mockRemoveEventListener).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockRemoveEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    })

    it('should flush remaining errors on destroy', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 5000 // Long interval
      })

      errorLogger.logError('Pending error')
      errorLogger.destroy()

      // Should send immediately on destroy
      await new Promise(r => setTimeout(r, 50))

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('error context', () => {
    it('should include userAgent, url, timestamp', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      errorLogger.logError('Test error')

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const context = body.errors[0].context

      expect(context.userAgent).toBeDefined()
      expect(context.url).toBeDefined()
      expect(context.timestamp).toBeDefined()
      expect(new Date(context.timestamp).getTime()).not.toBeNaN()
    })

    it('should filter context to safe primitive values', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      errorLogger.logError('Test error', {
        code: 500,
        reason: 'Server error',
        complexObject: { nested: 'value' } as unknown as string
      })

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const context = body.errors[0].context

      expect(context.code).toBe(500)
      expect(context.reason).toBe('Server error')
      expect(context.complexObject).toBeUndefined()
    })

    it('should filter out sensitive keys from context', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      errorLogger.logError('Test error', {
        code: 500,
        password: 'secret123',
        apiKey: 'key-abc',
        userToken: 'tok-xyz',
        authHeader: 'Bearer xxx',
        safeField: 'visible'
      })

      await new Promise(r => setTimeout(r, 100))

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const context = body.errors[0].context

      expect(context.code).toBe(500)
      expect(context.safeField).toBe('visible')
      expect(context.password).toBeUndefined()
      expect(context.apiKey).toBeUndefined()
      expect(context.userToken).toBeUndefined()
      expect(context.authHeader).toBeUndefined()
    })
  })

  describe('network failures', () => {
    it('should silently ignore fetch failures', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockRejectedValue(new Error('Network error'))

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      // Should not throw
      errorLogger.logError('Test error')

      await new Promise(r => setTimeout(r, 100))

      // Fetch was called, but error was swallowed
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('globalErrorHandler', () => {
    it('should filter Script error. messages (cross-origin)', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      // Get the registered error handler
      const errorHandler = mockAddEventListener.mock.calls.find(
        (call: unknown[]) => call[0] === 'error'
      )?.[1] as (event: ErrorEvent) => void

      expect(errorHandler).toBeDefined()

      // Simulate cross-origin script error
      const crossOriginEvent = {
        message: 'Script error.',
        filename: '',
        lineno: 0,
        colno: 0,
        error: null
      } as ErrorEvent

      errorHandler(crossOriginEvent)

      await new Promise(r => setTimeout(r, 100))

      // Should NOT send cross-origin errors
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should include filename, lineno, colno in context', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      const errorHandler = mockAddEventListener.mock.calls.find(
        (call: unknown[]) => call[0] === 'error'
      )?.[1] as (event: ErrorEvent) => void

      // Simulate error with file info
      const errorEvent = {
        message: 'ReferenceError: foo is not defined',
        filename: 'https://example.com/widget.js',
        lineno: 42,
        colno: 15,
        error: null
      } as ErrorEvent

      errorHandler(errorEvent)

      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].context.filename).toBe('https://example.com/widget.js')
      expect(body.errors[0].context.lineno).toBe(42)
      expect(body.errors[0].context.colno).toBe(15)
    })

    it('should handle ErrorEvent with error object and capture stack', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      const errorHandler = mockAddEventListener.mock.calls.find(
        (call: unknown[]) => call[0] === 'error'
      )?.[1] as (event: ErrorEvent) => void

      const actualError = new Error('Actual error with stack')
      const errorEvent = {
        message: 'Error: Actual error with stack',
        filename: 'https://example.com/widget.js',
        lineno: 100,
        colno: 5,
        error: actualError
      } as ErrorEvent

      errorHandler(errorEvent)

      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].message).toBe('Actual error with stack')
      expect(body.errors[0].stack).toContain('Error: Actual error with stack')
    })
  })

  describe('rejectionHandler', () => {
    it('should log unhandled promise rejections', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      const rejectionHandler = mockAddEventListener.mock.calls.find(
        (call: unknown[]) => call[0] === 'unhandledrejection'
      )?.[1] as (event: PromiseRejectionEvent) => void

      expect(rejectionHandler).toBeDefined()

      // Simulate unhandled rejection with string
      const rejectionEvent = {
        reason: 'Something went wrong'
      } as PromiseRejectionEvent

      rejectionHandler(rejectionEvent)

      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].message).toBe('Unhandled rejection: Something went wrong')
    })

    it('should handle rejection with Error object and capture stack', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      const rejectionHandler = mockAddEventListener.mock.calls.find(
        (call: unknown[]) => call[0] === 'unhandledrejection'
      )?.[1] as (event: PromiseRejectionEvent) => void

      const error = new Error('Promise failed')
      const rejectionEvent = {
        reason: error
      } as PromiseRejectionEvent

      rejectionHandler(rejectionEvent)

      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].message).toBe('Unhandled rejection: Promise failed')
      expect(body.errors[0].stack).toContain('Error: Promise failed')
    })

    it('should handle rejection with primitive value', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 50
      })

      const rejectionHandler = mockAddEventListener.mock.calls.find(
        (call: unknown[]) => call[0] === 'unhandledrejection'
      )?.[1] as (event: PromiseRejectionEvent) => void

      // Simulate rejection with number
      const rejectionEvent = {
        reason: 404
      } as PromiseRejectionEvent

      rejectionHandler(rejectionEvent)

      await new Promise(r => setTimeout(r, 100))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors[0].message).toBe('Unhandled rejection: 404')
    })
  })

  describe('maxQueueSize', () => {
    it('should drop errors when queue is full', async () => {
      const { errorLogger } = errorLoggerModule

      mockFetch.mockResolvedValue({ ok: true })

      errorLogger.init({
        apiUrl: 'https://api.example.com',
        batchIntervalMs: 5000, // Long interval to prevent auto-flush
        maxQueueSize: 3
      })

      // Fill queue beyond limit
      errorLogger.logError('Error 1')
      errorLogger.logError('Error 2')
      errorLogger.logError('Error 3')
      errorLogger.logError('Error 4') // Should be dropped
      errorLogger.logError('Error 5') // Should be dropped

      // Manually trigger flush via destroy
      errorLogger.destroy()

      await new Promise(r => setTimeout(r, 50))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.errors).toHaveLength(3)
      expect(body.errors[0].message).toBe('Error 1')
      expect(body.errors[1].message).toBe('Error 2')
      expect(body.errors[2].message).toBe('Error 3')
    })
  })
})

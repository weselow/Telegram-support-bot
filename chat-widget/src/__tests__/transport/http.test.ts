import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient, ChatHttpError, RateLimitError } from '../../transport/http'

// Mock error logger to prevent side effects
vi.mock('../../utils/error-logger', () => ({
  errorLogger: {
    init: vi.fn(),
    logError: vi.fn(),
    logWarning: vi.fn(),
    setSessionId: vi.fn(),
    destroy: vi.fn()
  }
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('ChatHttpError', () => {
  it('should create error with status and message', () => {
    const error = new ChatHttpError(404, 'Not found')
    expect(error.status).toBe(404)
    expect(error.message).toBe('Not found')
    expect(error.name).toBe('ChatHttpError')
  })

  it('should be instance of Error', () => {
    const error = new ChatHttpError(500, 'Server error')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('RateLimitError', () => {
  it('should create error with message and retry time', () => {
    const error = new RateLimitError('Too many requests', 30)
    expect(error.message).toBe('Too many requests')
    expect(error.retryAfterSeconds).toBe(30)
    expect(error.name).toBe('RateLimitError')
  })

  it('should be instance of Error', () => {
    const error = new RateLimitError('Rate limited', 60)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('HttpClient', () => {
  let client: HttpClient

  beforeEach(() => {
    client = new HttpClient('https://api.example.com')
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('init', () => {
    it('should make POST request to /api/chat/init', async () => {
      const mockResponse = { sessionId: 'test-session' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.init()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/chat/init',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should send empty JSON body for POST', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      await client.init()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: '{}'
        })
      )
    })
  })

  describe('getHistory', () => {
    it('should make GET request to /api/chat/history', async () => {
      const mockResponse = { messages: [], hasMore: false }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.getHistory()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/chat/history',
        expect.objectContaining({
          credentials: 'include'
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should add limit parameter to query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], hasMore: false })
      })

      await client.getHistory({ limit: 50 })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/chat/history?limit=50',
        expect.any(Object)
      )
    })

    it('should add before parameter to query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], hasMore: false })
      })

      await client.getHistory({ before: '2025-12-30T00:00:00Z' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('before='),
        expect.any(Object)
      )
    })

    it('should add multiple parameters to query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], hasMore: false })
      })

      await client.getHistory({ limit: 20, after: 'msg-123' })

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('limit=20')
      expect(url).toContain('after=msg-123')
    })
  })

  describe('linkTelegram', () => {
    it('should make POST request to /api/chat/link-telegram', async () => {
      const mockResponse = { url: 'https://t.me/bot?start=xyz' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      })

      const result = await client.linkTelegram()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/chat/link-telegram',
        expect.objectContaining({
          method: 'POST'
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('close', () => {
    it('should make POST request to /api/chat/close', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({})
      })

      await client.close()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/api/chat/close',
        expect.objectContaining({
          method: 'POST'
        })
      )
    })
  })

  describe('error handling', () => {
    it('should throw ChatHttpError for non-OK responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      })

      const error = await client.init().catch(e => e)
      expect(error).toBeInstanceOf(ChatHttpError)
      expect(error.status).toBe(500)
      expect(error.message).toBe('Internal Server Error')
    })

    it('should throw RateLimitError for 429 status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '30' }),
        text: () => Promise.resolve('Too Many Requests')
      })

      await expect(client.init()).rejects.toThrow(RateLimitError)
    })

    it('should parse Retry-After header for 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '45' }),
        text: () => Promise.resolve('')
      })

      try {
        await client.init()
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError)
        expect((error as RateLimitError).retryAfterSeconds).toBe(45)
      }
    })

    it('should default to 60s retry for 429 without header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers(),
        text: () => Promise.resolve('')
      })

      try {
        await client.init()
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitError)
        expect((error as RateLimitError).retryAfterSeconds).toBe(60)
      }
    })

    it('should handle text() failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.reject(new Error('Failed'))
      })

      await expect(client.init()).rejects.toMatchObject({
        message: 'Unknown error'
      })
    })
  })

  describe('401 session recovery', () => {
    it('should retry request after reinitializing on 401', async () => {
      // First getHistory fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      })
      // init succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'new-session' })
      })
      // Retry getHistory succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ messages: [], hasMore: false })
      })

      const result = await client.getHistory()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result).toEqual({ messages: [], hasMore: false })
    })

    it('should throw if reinit also fails', async () => {
      // First getHistory fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      })
      // init also fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      })

      await expect(client.getHistory()).rejects.toThrow(ChatHttpError)
    })

    it('should not retry on non-401 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      })

      await expect(client.getHistory()).rejects.toThrow(ChatHttpError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should prevent infinite 401 retry loop', async () => {
      // First request fails with 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      })
      // init succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionId: 'new-session' })
      })
      // Retry also fails with 401 - should NOT trigger another reinit
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Still Unauthorized')
      })

      await expect(client.getHistory()).rejects.toThrow(ChatHttpError)
      // Should be 3 calls: original, init, retry - no more
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })
  })
})

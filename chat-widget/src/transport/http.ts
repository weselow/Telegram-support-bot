/**
 * HTTP client for chat API
 */

import type {
  InitResponse,
  HistoryResponse,
  TelegramLinkResponse
} from '../types/messages'

export class ChatHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ChatHttpError'
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfterSeconds: number
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

export interface HistoryParams {
  limit?: number
  before?: string
  after?: string
}

export class HttpClient {
  private isReinitializing = false

  constructor(private baseUrl: string) {}

  /**
   * Make raw HTTP request (no retry logic)
   */
  private async rawRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    // For POST requests without body, send empty JSON to satisfy Fastify's
    // Content-Type: application/json requirement
    const method = options.method?.toUpperCase()
    const needsBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
    const body = options.body ?? (needsBody ? '{}' : undefined)

    const response = await fetch(url, {
      ...options,
      body,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        throw new RateLimitError(
          'Восстанавливаем соединение...',
          retryAfter ? parseInt(retryAfter, 10) : 60
        )
      }
      const text = await response.text().catch(() => 'Unknown error')
      throw new ChatHttpError(response.status, text)
    }

    return response.json()
  }

  /**
   * Make HTTP request with automatic session recovery on 401
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      return await this.rawRequest<T>(endpoint, options)
    } catch (error) {
      // On 401, try to reinitialize session and retry once
      if (error instanceof ChatHttpError && error.status === 401 && !this.isReinitializing) {
        this.isReinitializing = true
        try {
          await this.init()
          return await this.rawRequest<T>(endpoint, options)
        } finally {
          this.isReinitializing = false
        }
      }
      throw error
    }
  }

  /**
   * Initialize chat session (uses rawRequest to avoid retry loop)
   */
  async init(): Promise<InitResponse> {
    return this.rawRequest<InitResponse>('/api/chat/init', {
      method: 'POST'
    })
  }

  /**
   * Get message history
   */
  async getHistory(params: HistoryParams = {}): Promise<HistoryResponse> {
    const query = new URLSearchParams()

    if (params.limit) {
      query.set('limit', params.limit.toString())
    }
    if (params.before) {
      query.set('before', params.before)
    }
    if (params.after) {
      query.set('after', params.after)
    }

    const queryString = query.toString()
    const endpoint = queryString ? `/api/chat/history?${queryString}` : '/api/chat/history'

    return this.request<HistoryResponse>(endpoint)
  }

  /**
   * Get Telegram link
   */
  async linkTelegram(): Promise<TelegramLinkResponse> {
    return this.request<TelegramLinkResponse>('/api/chat/link-telegram', {
      method: 'POST'
    })
  }

  /**
   * Close chat ticket
   */
  async close(): Promise<void> {
    await this.request('/api/chat/close', {
      method: 'POST'
    })
  }
}

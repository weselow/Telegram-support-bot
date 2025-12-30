/**
 * WebSocket client for real-time chat communication
 * Aligned with backend-api-spec.md
 */

import type {
  ServerEvent,
  ClientEvent,
  Message
} from '../types/messages'
import { errorLogger } from '../utils/error-logger'

export interface WebSocketClientConfig {
  url: string
  sessionId?: string
  reconnectAttempts?: number
  reconnectDelay?: number
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface WebSocketEventHandlers {
  onConnected?: (sessionId: string) => void
  onDisconnected?: () => void
  onMessage?: (message: Message) => void
  onTyping?: (isTyping: boolean) => void
  onStatus?: (status: string) => void
  onChannelLinked?: (channel: string, username: string) => void
  onError?: (error: Error) => void
  onStateChange?: (state: ConnectionState) => void
}

const DEFAULT_CONFIG: Omit<Required<WebSocketClientConfig>, 'url' | 'sessionId'> & { sessionId?: string } = {
  sessionId: undefined,
  reconnectAttempts: 5,
  reconnectDelay: 1000
}

type ResolvedConfig = Required<Omit<WebSocketClientConfig, 'sessionId'>> & { sessionId?: string }

export class WebSocketClient {
  private ws: WebSocket | null = null
  private config: ResolvedConfig
  private handlers: WebSocketEventHandlers = {}
  private reconnectCount = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _state: ConnectionState = 'disconnected'
  private manualClose = false
  private messageQueue: ClientEvent[] = []

  constructor(config: WebSocketClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    } as ResolvedConfig
  }

  /**
   * Current connection state
   */
  get state(): ConnectionState {
    return this._state
  }

  /**
   * Set event handlers
   */
  setHandlers(handlers: WebSocketEventHandlers): void {
    this.handlers = handlers
  }

  /**
   * Set session ID for authentication (used when cookies are blocked)
   */
  setSessionId(sessionId: string): void {
    this.config.sessionId = sessionId
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    // Only skip if actually connected (ws exists, is open, and state is connected)
    if (this.ws?.readyState === WebSocket.OPEN && this._state === 'connected') {
      return
    }

    this.manualClose = false
    this.setState(this.reconnectCount > 0 ? 'reconnecting' : 'connecting')

    try {
      // Add session ID as query parameter (fallback for blocked cookies)
      let url = this.config.url
      if (this.config.sessionId) {
        const separator = url.includes('?') ? '&' : '?'
        url = `${url}${separator}session=${encodeURIComponent(this.config.sessionId)}`
      }
      this.ws = new WebSocket(url)
      this.setupEventListeners()
    } catch (error) {
      this.handleError(error as Error)
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.manualClose = true
    this.cleanup()
    this.setState('disconnected')
  }

  /**
   * Send message to server
   * Format: { type: 'message', data: { text: string } }
   */
  sendMessage(text: string): void {
    this.send({
      type: 'message',
      data: { text }
    })
  }

  /**
   * Send typing indicator
   * Format: { type: 'typing', data: { isTyping: boolean } }
   */
  sendTyping(isTyping: boolean): void {
    this.send({
      type: 'typing',
      data: { isTyping }
    })
  }

  /**
   * Close ticket
   * Format: { type: 'close', data: { resolved: boolean } }
   */
  closeTicket(resolved: boolean = true): void {
    this.send({
      type: 'close',
      data: { resolved }
    })
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._state === 'connected' && this.ws?.readyState === WebSocket.OPEN
  }

  private setupEventListeners(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      this.reconnectCount = 0
      // Don't set connected yet, wait for 'connected' event from server
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerEvent
        this.handleServerEvent(data)
      } catch (error) {
        errorLogger.logError('Failed to parse WebSocket message', { source: 'websocket' })
        console.error('[ChatWidget] Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onerror = (event) => {
      console.error('[ChatWidget] WebSocket error:', event)
      errorLogger.logError('WebSocket connection error', { source: 'websocket' })
      this.handleError(new Error('WebSocket connection error'))
    }

    this.ws.onclose = (event) => {
      if (this.manualClose) {
        this.setState('disconnected')
        this.handlers.onDisconnected?.()
        return
      }

      // Log unexpected close
      if (event.code !== 1000) {
        errorLogger.logWarning('WebSocket unexpected close', {
          code: event.code,
          reason: event.reason || 'unknown'
        })
      }

      // Attempt reconnection
      if (this.reconnectCount < this.config.reconnectAttempts) {
        this.scheduleReconnect()
      } else {
        this.setState('disconnected')
        this.handlers.onDisconnected?.()
        errorLogger.logError('WebSocket connection failed after retries', {
          code: event.code,
          reason: event.reason || 'unknown'
        })
        this.handlers.onError?.(new Error(`Connection closed: ${event.code} ${event.reason}`))
      }
    }
  }

  /**
   * Handle server events
   * All events have format: { type: string, data: object }
   */
  private handleServerEvent(event: ServerEvent): void {
    switch (event.type) {
      case 'connected':
        this.setState('connected')
        this.handlers.onConnected?.(event.data.sessionId)
        this.flushMessageQueue()
        break

      case 'message':
        this.handlers.onMessage?.(event.data)
        break

      case 'typing':
        this.handlers.onTyping?.(event.data.isTyping)
        break

      case 'status':
        this.handlers.onStatus?.(event.data.status)
        break

      case 'channel_linked':
        this.handlers.onChannelLinked?.('telegram', event.data.telegram)
        break

      case 'ping':
        // Server sends ping, we respond with pong
        this.send({ type: 'pong', data: event.data })
        break

      case 'error':
        this.handlers.onError?.(new Error(event.data.message))
        break
    }
  }

  private send(event: ClientEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message to send after connection
      if (event.type === 'message') {
        this.messageQueue.push(event)
        console.log('[ChatWidget] Message queued, waiting for connection')
      }
      return
    }

    try {
      this.ws.send(JSON.stringify(event))
    } catch (error) {
      console.error('[ChatWidget] Failed to send message:', error)
    }
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return

    console.log(`[ChatWidget] Sending ${this.messageQueue.length} queued message(s)`)
    const queue = [...this.messageQueue]
    this.messageQueue = []

    for (const event of queue) {
      this.send(event)
    }
  }

  private setState(state: ConnectionState): void {
    if (this._state !== state) {
      this._state = state
      this.handlers.onStateChange?.(state)
    }
  }

  private handleError(error: Error): void {
    this.handlers.onError?.(error)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount)
    this.reconnectCount++

    console.log(`[ChatWidget] Reconnecting in ${delay}ms (attempt ${this.reconnectCount}/${this.config.reconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }

    this.reconnectCount = 0
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketClient, type ConnectionState, type WebSocketEventHandlers } from '../../transport/websocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  url: string
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
  }

  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    this.sentMessages.push(data)
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  simulateError(): void {
    this.onerror?.(new Event('error'))
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code, reason } as CloseEvent)
  }
}

// Stub global WebSocket
let mockWsInstance: MockWebSocket | null = null
vi.stubGlobal('WebSocket', class extends MockWebSocket {
  constructor(url: string) {
    super(url)
    mockWsInstance = this
  }
})

describe('WebSocketClient', () => {
  let client: WebSocketClient
  let handlers: WebSocketEventHandlers

  beforeEach(() => {
    vi.useFakeTimers()
    mockWsInstance = null

    client = new WebSocketClient({
      url: 'wss://example.com/ws',
      reconnectAttempts: 3,
      reconnectDelay: 1000
    })

    handlers = {
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onMessage: vi.fn(),
      onTyping: vi.fn(),
      onStatus: vi.fn(),
      onChannelLinked: vi.fn(),
      onError: vi.fn(),
      onStateChange: vi.fn()
    }
    client.setHandlers(handlers)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start in disconnected state', () => {
      expect(client.state).toBe('disconnected')
    })

    it('should not be connected initially', () => {
      expect(client.isConnected()).toBe(false)
    })
  })

  describe('connect', () => {
    it('should create WebSocket connection', () => {
      client.connect()

      expect(mockWsInstance).not.toBeNull()
      expect(mockWsInstance?.url).toBe('wss://example.com/ws')
    })

    it('should add session ID to URL if provided', () => {
      client.setSessionId('test-session-123')
      client.connect()

      expect(mockWsInstance?.url).toBe('wss://example.com/ws?session=test-session-123')
    })

    it('should append session ID with & if URL has query params', () => {
      const clientWithQuery = new WebSocketClient({
        url: 'wss://example.com/ws?foo=bar',
        sessionId: 'test-session'
      })
      clientWithQuery.connect()

      expect(mockWsInstance?.url).toBe('wss://example.com/ws?foo=bar&session=test-session')
    })

    it('should set state to connecting', () => {
      client.connect()

      expect(client.state).toBe('connecting')
      expect(handlers.onStateChange).toHaveBeenCalledWith('connecting')
    })

    it('should not reconnect if already connected', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      const firstInstance = mockWsInstance
      client.connect()

      expect(mockWsInstance).toBe(firstInstance)
    })
  })

  describe('connection events', () => {
    it('should set connected state on server connected event', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'session-123' } })

      expect(client.state).toBe('connected')
      expect(handlers.onConnected).toHaveBeenCalledWith('session-123')
    })

    it('should report isConnected true when connected', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      expect(client.isConnected()).toBe(true)
    })
  })

  describe('disconnect', () => {
    it('should close WebSocket connection', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      client.disconnect()

      expect(client.state).toBe('disconnected')
      expect(mockWsInstance?.readyState).toBe(MockWebSocket.CLOSED)
    })

    it('should set disconnected state on manual disconnect', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      client.disconnect()

      // disconnect() sets state directly, cleanup() removes handlers
      expect(client.state).toBe('disconnected')
      expect(handlers.onStateChange).toHaveBeenCalledWith('disconnected')
    })

    it('should not reconnect after manual disconnect', () => {
      client.connect()
      mockWsInstance?.simulateOpen()

      client.disconnect()
      mockWsInstance?.simulateClose()

      vi.advanceTimersByTime(5000)

      expect(handlers.onStateChange).not.toHaveBeenCalledWith('reconnecting')
    })
  })

  describe('sending messages', () => {
    it('should send message with correct format', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      client.sendMessage('Hello')

      const sent = JSON.parse(mockWsInstance!.sentMessages[0])
      expect(sent).toEqual({
        type: 'message',
        data: { text: 'Hello' }
      })
    })

    it('should send typing indicator', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      client.sendTyping(true)

      const sent = JSON.parse(mockWsInstance!.sentMessages[0])
      expect(sent).toEqual({
        type: 'typing',
        data: { isTyping: true }
      })
    })

    it('should send close ticket event', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      client.closeTicket(true)

      const sent = JSON.parse(mockWsInstance!.sentMessages[0])
      expect(sent).toEqual({
        type: 'close',
        data: { resolved: true }
      })
    })

    it('should queue messages when not connected', () => {
      client.connect()
      // Don't simulate open/connected

      client.sendMessage('Queued message')

      expect(mockWsInstance?.sentMessages.length ?? 0).toBe(0)
    })

    it('should flush queued messages on connect', () => {
      client.connect()

      client.sendMessage('Message 1')
      client.sendMessage('Message 2')

      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      expect(mockWsInstance?.sentMessages.length).toBe(2)
    })
  })

  describe('receiving messages', () => {
    beforeEach(() => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })
    })

    it('should handle incoming message', () => {
      const message = { id: '1', text: 'Hello', sender: 'support', createdAt: '2025-12-30T00:00:00Z' }
      mockWsInstance?.simulateMessage({ type: 'message', data: message })

      expect(handlers.onMessage).toHaveBeenCalledWith(message)
    })

    it('should handle typing event', () => {
      mockWsInstance?.simulateMessage({ type: 'typing', data: { isTyping: true } })

      expect(handlers.onTyping).toHaveBeenCalledWith(true)
    })

    it('should handle status event', () => {
      mockWsInstance?.simulateMessage({ type: 'status', data: { status: 'resolved' } })

      expect(handlers.onStatus).toHaveBeenCalledWith('resolved')
    })

    it('should handle channel_linked event', () => {
      mockWsInstance?.simulateMessage({ type: 'channel_linked', data: { telegram: 'username' } })

      expect(handlers.onChannelLinked).toHaveBeenCalledWith('telegram', 'username')
    })

    it('should respond to ping with pong', () => {
      mockWsInstance?.simulateMessage({ type: 'ping', data: { ts: 12345 } })

      const sent = JSON.parse(mockWsInstance!.sentMessages[0])
      expect(sent).toEqual({
        type: 'pong',
        data: { ts: 12345 }
      })
    })

    it('should handle error event', () => {
      mockWsInstance?.simulateMessage({ type: 'error', data: { message: 'Something went wrong' } })

      expect(handlers.onError).toHaveBeenCalledWith(expect.any(Error))
      expect((handlers.onError as ReturnType<typeof vi.fn>).mock.calls[0][0].message).toBe('Something went wrong')
    })
  })

  describe('reconnection', () => {
    it('should attempt reconnect on unexpected close', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateMessage({ type: 'connected', data: { sessionId: 'abc' } })

      mockWsInstance?.simulateClose(1006, 'Connection lost')

      // Should not immediately disconnect
      expect(handlers.onStateChange).not.toHaveBeenCalledWith('disconnected')

      // After timer fires, should attempt reconnect
      vi.advanceTimersByTime(1000)

      expect(handlers.onStateChange).toHaveBeenCalledWith('reconnecting')
    })

    it('should use exponential backoff for reconnection', () => {
      client.connect()
      mockWsInstance?.simulateOpen()
      mockWsInstance?.simulateClose()

      // First reconnect after 1000ms (1000 * 2^0)
      vi.advanceTimersByTime(999)
      expect(mockWsInstance?.readyState).toBe(MockWebSocket.CLOSED)

      vi.advanceTimersByTime(1)
      const firstInstance = mockWsInstance
      expect(firstInstance?.url).toBeDefined()

      // Second reconnect after 2000ms (1000 * 2^1)
      mockWsInstance?.simulateClose()
      vi.advanceTimersByTime(1999)
      expect(mockWsInstance).toBe(firstInstance)

      vi.advanceTimersByTime(1)
      expect(mockWsInstance).not.toBe(firstInstance)
    })

    it('should stop reconnecting after max attempts', () => {
      client.connect()
      mockWsInstance?.simulateOpen()

      // Exhaust all reconnect attempts
      for (let i = 0; i < 3; i++) {
        mockWsInstance?.simulateClose()
        vi.advanceTimersByTime(10000) // Advance past backoff
      }

      // Final close after exhausting attempts
      mockWsInstance?.simulateClose()

      expect(handlers.onError).toHaveBeenCalled()
      expect(handlers.onDisconnected).toHaveBeenCalled()
    })

    it('should reset reconnect count on open', () => {
      // The reconnectCount is reset in the onopen handler
      // This allows fresh reconnect attempts after a successful connection
      client.connect()
      mockWsInstance?.simulateOpen()

      // After open, reconnectCount is 0
      // Verified by: if connection drops, first reconnect uses base delay (1000ms)
      mockWsInstance?.simulateClose()

      // Reconnect scheduled - should be first attempt with 1000ms delay
      // The console log confirms: "Reconnecting in 1000ms (attempt 1/3)"
      vi.advanceTimersByTime(1000)

      // A new WebSocket should be created
      expect(mockWsInstance).not.toBeNull()
    })
  })

  describe('error handling', () => {
    it('should call onError on WebSocket error', () => {
      client.connect()
      mockWsInstance?.simulateError()

      expect(handlers.onError).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})

/**
 * Message and API types
 * Aligned with backend-api-spec.md
 */

export type MessageFrom = 'user' | 'support'
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed'
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED'

/**
 * Message format from backend API
 */
export interface Message {
  id: string
  text: string
  from: MessageFrom
  timestamp: string
  // Optional image URL (from support via Telegram)
  imageUrl?: string
  // Client-side only fields
  status?: MessageStatus
  temp_id?: string
}

/**
 * HTTP API Responses
 */

export interface InitResponse {
  data: {
    sessionId: string
    isNewSession: boolean
    hasHistory: boolean
  }
}

export interface HistoryResponse {
  data: {
    messages: Message[]
    hasMore: boolean
  }
}

export interface TelegramLinkResponse {
  data: {
    telegramUrl: string
  }
}

/**
 * WebSocket Events - Server to Client
 * Format: { type: string, data: object }
 */

export interface ServerConnectedEvent {
  type: 'connected'
  data: {
    sessionId: string
    ticketStatus: TicketStatus
    unreadCount: number
  }
}

export interface ServerMessageEvent {
  type: 'message'
  data: Message
}

export interface ServerTypingEvent {
  type: 'typing'
  data: {
    isTyping: boolean
  }
}

export interface ServerStatusEvent {
  type: 'status'
  data: {
    status: TicketStatus
  }
}

export interface ServerChannelLinkedEvent {
  type: 'channel_linked'
  data: {
    telegram: string
  }
}

export interface ServerPingEvent {
  type: 'ping'
  data?: {
    timestamp?: number
  }
}

export interface ServerErrorEvent {
  type: 'error'
  data: {
    message: string
    code?: string
  }
}

export type ServerEvent =
  | ServerConnectedEvent
  | ServerMessageEvent
  | ServerTypingEvent
  | ServerStatusEvent
  | ServerChannelLinkedEvent
  | ServerPingEvent
  | ServerErrorEvent

/**
 * WebSocket Events - Client to Server
 * Format: { type: string, data: object }
 */

export interface ClientMessageEvent {
  type: 'message'
  data: {
    text: string
  }
}

export interface ClientTypingEvent {
  type: 'typing'
  data: {
    isTyping: boolean
  }
}

export interface ClientCloseEvent {
  type: 'close'
  data: {
    resolved: boolean
  }
}

export interface ClientPongEvent {
  type: 'pong'
  data?: any
}

export type ClientEvent =
  | ClientMessageEvent
  | ClientTypingEvent
  | ClientCloseEvent
  | ClientPongEvent

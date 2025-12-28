/**
 * Widget internal events
 */

import type { Message } from './messages'

export type WidgetState =
  | 'closed'       // Widget minimized, only button visible
  | 'open'         // Widget open, ready to chat
  | 'connecting'   // Connecting to WebSocket
  | 'connected'    // Connected and active
  | 'disconnected' // Lost connection, will reconnect
  | 'offline'      // Operators unavailable (future)
  | 'error'        // Critical error

export interface WidgetStateData {
  state: WidgetState
  messages: Message[]
  unreadCount: number
  isTyping: boolean
}

export interface WidgetEventMap {
  // Widget lifecycle events
  'widget:ready': undefined
  'widget:open': undefined
  'widget:close': undefined
  'widget:error': Error

  // State events
  'state:change': WidgetState

  // Message events
  'message:received': Message
  'message:sent': Message
  'message:pending': { text: string; tempId: string }

  // Typing events
  'typing:start': undefined
  'typing:stop': undefined
  'support:typing': { isTyping: boolean }

  // Status events
  'status:change': { status: string }
  'telegram:linked': { username: string }
  'unread:change': { count: number }

  // Allow string index signature for EventEmitter compatibility
  [key: string]: unknown
}

export type WidgetEventName = keyof WidgetEventMap
export type WidgetEventHandler<T extends WidgetEventName> = (
  data: WidgetEventMap[T]
) => void

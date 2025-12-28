/**
 * Widget state management
 */

import type { Message } from '../types/messages'
import type { WidgetState, WidgetEventMap, WidgetStateData } from '../types/events'
import { EventEmitter } from './events'

const initialState: WidgetStateData = {
  state: 'closed',
  messages: [],
  unreadCount: 0,
  isTyping: false
}

export class StateManager extends EventEmitter<WidgetEventMap> {
  private data: WidgetStateData

  constructor() {
    super()
    this.data = { ...initialState }
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<WidgetStateData> {
    return this.data
  }

  /**
   * Set widget state
   */
  setState(state: WidgetState): void {
    if (this.data.state !== state) {
      this.data.state = state
      this.emit('state:change', state)
    }
  }

  /**
   * Set messages (replace all)
   */
  setMessages(messages: Message[]): void {
    this.data.messages = [...messages]
  }

  /**
   * Add message
   */
  addMessage(message: Message): void {
    this.data.messages = [...this.data.messages, message]
    this.emit('message:received', message)
  }

  /**
   * Prepend messages (for history loading)
   */
  prependMessages(messages: Message[]): void {
    this.data.messages = [...messages, ...this.data.messages]
  }

  /**
   * Set typing status
   */
  setTyping(isTyping: boolean): void {
    this.data.isTyping = isTyping
    this.emit('support:typing', { isTyping })
  }

  /**
   * Increment unread count
   */
  incrementUnread(): void {
    this.data.unreadCount++
    this.emit('unread:change', { count: this.data.unreadCount })
  }

  /**
   * Clear unread count
   */
  clearUnread(): void {
    if (this.data.unreadCount > 0) {
      this.data.unreadCount = 0
      this.emit('unread:change', { count: 0 })
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.data = { ...initialState }
  }
}

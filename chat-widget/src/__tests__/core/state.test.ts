import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StateManager } from '../../core/state'
import type { Message } from '../../types/messages'

describe('StateManager', () => {
  let stateManager: StateManager

  const createMessage = (id: string, text: string): Message => ({
    id,
    text,
    sender: 'user',
    createdAt: '2025-12-30T12:00:00.000Z'
  })

  beforeEach(() => {
    stateManager = new StateManager()
  })

  describe('initial state', () => {
    it('should have closed state initially', () => {
      expect(stateManager.getState().state).toBe('closed')
    })

    it('should have empty messages initially', () => {
      expect(stateManager.getState().messages).toEqual([])
    })

    it('should have zero unread count initially', () => {
      expect(stateManager.getState().unreadCount).toBe(0)
    })

    it('should have isTyping false initially', () => {
      expect(stateManager.getState().isTyping).toBe(false)
    })
  })

  describe('setState', () => {
    it('should update widget state', () => {
      stateManager.setState('open')
      expect(stateManager.getState().state).toBe('open')
    })

    it('should emit state:change event', () => {
      const handler = vi.fn()
      stateManager.on('state:change', handler)

      stateManager.setState('connected')

      expect(handler).toHaveBeenCalledWith('connected')
    })

    it('should not emit event if state unchanged', () => {
      stateManager.setState('open')
      const handler = vi.fn()
      stateManager.on('state:change', handler)

      stateManager.setState('open') // Same state

      expect(handler).not.toHaveBeenCalled()
    })

    it('should support all widget states', () => {
      const states = ['closed', 'open', 'connecting', 'connected', 'disconnected', 'offline', 'error'] as const

      for (const state of states) {
        stateManager.setState(state)
        expect(stateManager.getState().state).toBe(state)
      }
    })
  })

  describe('setMessages', () => {
    it('should replace all messages', () => {
      const messages = [
        createMessage('1', 'First'),
        createMessage('2', 'Second')
      ]

      stateManager.setMessages(messages)

      expect(stateManager.getState().messages).toEqual(messages)
    })

    it('should create a copy of messages array', () => {
      const messages = [createMessage('1', 'Test')]
      stateManager.setMessages(messages)

      // Modifying original should not affect state
      messages.push(createMessage('2', 'Another'))

      expect(stateManager.getState().messages.length).toBe(1)
    })

    it('should replace existing messages', () => {
      stateManager.setMessages([createMessage('1', 'Old')])
      stateManager.setMessages([createMessage('2', 'New')])

      expect(stateManager.getState().messages.length).toBe(1)
      expect(stateManager.getState().messages[0].text).toBe('New')
    })
  })

  describe('addMessage', () => {
    it('should add message to end of list', () => {
      stateManager.addMessage(createMessage('1', 'First'))
      stateManager.addMessage(createMessage('2', 'Second'))

      const messages = stateManager.getState().messages
      expect(messages.length).toBe(2)
      expect(messages[1].text).toBe('Second')
    })

    it('should emit message:received event', () => {
      const handler = vi.fn()
      stateManager.on('message:received', handler)

      const message = createMessage('1', 'Test')
      stateManager.addMessage(message)

      expect(handler).toHaveBeenCalledWith(message)
    })

    it('should preserve existing messages', () => {
      stateManager.setMessages([createMessage('1', 'Existing')])
      stateManager.addMessage(createMessage('2', 'New'))

      expect(stateManager.getState().messages.length).toBe(2)
    })
  })

  describe('prependMessages', () => {
    it('should prepend messages to beginning', () => {
      stateManager.setMessages([createMessage('3', 'Current')])
      stateManager.prependMessages([
        createMessage('1', 'Old1'),
        createMessage('2', 'Old2')
      ])

      const messages = stateManager.getState().messages
      expect(messages.length).toBe(3)
      expect(messages[0].text).toBe('Old1')
      expect(messages[1].text).toBe('Old2')
      expect(messages[2].text).toBe('Current')
    })

    it('should preserve message order within prepended batch', () => {
      stateManager.prependMessages([
        createMessage('1', 'First'),
        createMessage('2', 'Second')
      ])

      const messages = stateManager.getState().messages
      expect(messages[0].text).toBe('First')
      expect(messages[1].text).toBe('Second')
    })
  })

  describe('setTyping', () => {
    it('should set typing status', () => {
      stateManager.setTyping(true)
      expect(stateManager.getState().isTyping).toBe(true)

      stateManager.setTyping(false)
      expect(stateManager.getState().isTyping).toBe(false)
    })

    it('should emit support:typing event', () => {
      const handler = vi.fn()
      stateManager.on('support:typing', handler)

      stateManager.setTyping(true)

      expect(handler).toHaveBeenCalledWith({ isTyping: true })
    })
  })

  describe('incrementUnread', () => {
    it('should increment unread count', () => {
      stateManager.incrementUnread()
      expect(stateManager.getState().unreadCount).toBe(1)

      stateManager.incrementUnread()
      expect(stateManager.getState().unreadCount).toBe(2)
    })

    it('should emit unread:change event', () => {
      const handler = vi.fn()
      stateManager.on('unread:change', handler)

      stateManager.incrementUnread()

      expect(handler).toHaveBeenCalledWith({ count: 1 })
    })
  })

  describe('clearUnread', () => {
    it('should clear unread count', () => {
      stateManager.incrementUnread()
      stateManager.incrementUnread()
      stateManager.clearUnread()

      expect(stateManager.getState().unreadCount).toBe(0)
    })

    it('should emit unread:change event with zero', () => {
      stateManager.incrementUnread()
      const handler = vi.fn()
      stateManager.on('unread:change', handler)

      stateManager.clearUnread()

      expect(handler).toHaveBeenCalledWith({ count: 0 })
    })

    it('should not emit event if already zero', () => {
      const handler = vi.fn()
      stateManager.on('unread:change', handler)

      stateManager.clearUnread()

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('should reset state to initial values', () => {
      // Modify state
      stateManager.setState('connected')
      stateManager.setMessages([createMessage('1', 'Test')])
      stateManager.setTyping(true)
      stateManager.incrementUnread()

      // Reset
      stateManager.reset()

      const state = stateManager.getState()
      expect(state.state).toBe('closed')
      expect(state.messages).toEqual([])
      expect(state.isTyping).toBe(false)
      expect(state.unreadCount).toBe(0)
    })
  })

  describe('event handling', () => {
    it('should allow unsubscribing from events', () => {
      const handler = vi.fn()
      const unsubscribe = stateManager.on('state:change', handler)

      stateManager.setState('open')
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()
      stateManager.setState('connected')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      stateManager.on('state:change', handler1)
      stateManager.on('state:change', handler2)

      stateManager.setState('open')

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })
  })
})

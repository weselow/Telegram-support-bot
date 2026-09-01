import { describe, it, expect } from 'vitest'
import { ChatWidget } from '../widget'
import { MISSING_SERVER_URLS_MESSAGE } from '../types/config'

describe('widget', () => {
  describe('constructor', () => {
    it('should refuse to start without the server addresses', () => {
      expect(() => new ChatWidget()).toThrow(MISSING_SERVER_URLS_MESSAGE)
    })

    it('should refuse to start when only some addresses are given', () => {
      expect(() => new ChatWidget({ apiUrl: 'https://chat.example.com' })).toThrow(
        MISSING_SERVER_URLS_MESSAGE
      )
    })

    it('should start when all addresses are given', () => {
      expect(
        () =>
          new ChatWidget({
            apiUrl: 'https://chat.example.com',
            wsUrl: 'wss://chat.example.com/ws/chat',
            baseUrl: 'https://chat.example.com/chat-widget'
          })
      ).not.toThrow()
    })
  })
})

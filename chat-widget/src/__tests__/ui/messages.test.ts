import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessagesList } from '../../ui/messages'
import type { Message } from '../../types/messages'

describe('MessagesList', () => {
  let list: MessagesList
  let element: HTMLElement

  const baseMessage: Message = {
    id: 'msg-1',
    text: '',
    from: 'support',
    timestamp: '2026-07-29T10:00:00.000Z'
  }

  beforeEach(() => {
    list = new MessagesList()
    element = list.getElement()
    // jsdom не реализует прокрутку
    element.scrollTo = vi.fn()
    document.body.appendChild(element)
  })

  describe('addMessage', () => {
    it('should render an image attachment as an img element', () => {
      list.addMessage({ ...baseMessage, imageUrl: 'https://example.com/api/media/photo-1' })

      const img = element.querySelector<HTMLImageElement>('.chat-message__image')
      expect(img).toBeTruthy()
      expect(img?.getAttribute('src')).toBe('https://example.com/api/media/photo-1')
      expect(element.querySelector('.chat-message__file')).toBeNull()
    })

    it('should render a file attachment as a download link', () => {
      list.addMessage({
        ...baseMessage,
        text: '[Документ]',
        fileUrl: 'https://example.com/api/media/doc-1'
      })

      const link = element.querySelector<HTMLAnchorElement>('.chat-message__file')
      expect(link).toBeTruthy()
      expect(link?.getAttribute('href')).toBe('https://example.com/api/media/doc-1')
      expect(link?.getAttribute('target')).toBe('_blank')
      expect(element.querySelector('.chat-message__image')).toBeNull()
    })

    it('should render a voice attachment as a player', () => {
      list.addMessage({
        ...baseMessage,
        voiceUrl: 'https://example.com/api/media/voice-1',
        voiceDuration: 5
      })

      expect(element.querySelector('.chat-message__voice')).toBeTruthy()
      expect(element.querySelector('.chat-message__file')).toBeNull()
      expect(element.querySelector('.chat-message__image')).toBeNull()
    })

    it('should render a plain text message without attachments', () => {
      list.addMessage({ ...baseMessage, text: 'Просто текст' })

      expect(element.querySelector('.chat-message__text')?.textContent).toBe('Просто текст')
      expect(element.querySelector('.chat-message__file')).toBeNull()
      expect(element.querySelector('.chat-message__image')).toBeNull()
    })
  })
})

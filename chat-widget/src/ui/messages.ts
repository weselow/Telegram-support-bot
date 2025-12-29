/**
 * Messages list component
 */

import { createElement, scrollToBottom, isScrolledToBottom, on } from '../utils/dom'
import { formatMessageText, formatTime, formatDate } from '../utils/escape'
import { icons } from './icons'
import type { Message, MessageStatus } from '../types/messages'

export interface MessagesListOptions {
  onScrollTop?: () => void
}

export class MessagesList {
  private element: HTMLElement
  private typingIndicator: HTMLElement | null = null
  private emptyState: HTMLElement | null = null
  private loadingState: HTMLElement | null = null
  private lastMessageDate: string = ''
  private autoScroll = true
  private unsubscribe: (() => void)[] = []
  private messageCount = 0
  private readonly maxMessages = 100

  constructor(private options: MessagesListOptions = {}) {
    this.element = this.createContainer()
    this.setupScrollListener()
    this.showEmptyState()
  }

  /**
   * Get container element
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * Add message to list
   */
  addMessage(message: Message): void {
    this.hideEmptyState()
    this.hideLoading()

    const shouldScroll = this.autoScroll && isScrolledToBottom(this.element)

    // Check if we need date separator
    const messageDate = formatDate(message.timestamp)
    if (messageDate !== this.lastMessageDate) {
      this.addDateSeparator(messageDate)
      this.lastMessageDate = messageDate
    }

    // Create and add message element
    const messageEl = this.createMessageElement(message)

    // Insert before typing indicator if present
    if (this.typingIndicator) {
      this.element.insertBefore(messageEl, this.typingIndicator)
    } else {
      this.element.appendChild(messageEl)
    }

    // Memory management: remove old messages if limit exceeded
    this.messageCount++
    if (this.messageCount > this.maxMessages) {
      this.removeOldestMessage()
    }

    if (shouldScroll) {
      scrollToBottom(this.element)
    }
  }

  /**
   * Remove oldest message from DOM to prevent memory leak
   */
  private removeOldestMessage(): void {
    const messages = this.element.querySelectorAll('.chat-message')
    if (messages.length > 0) {
      // Also remove date separator if it becomes orphaned
      const firstMessage = messages[0]
      const prevElement = firstMessage.previousElementSibling
      if (prevElement?.classList.contains('chat-date-separator')) {
        const nextMessage = messages[1]
        if (nextMessage) {
          const nextDate = nextMessage.previousElementSibling
          if (nextDate?.classList.contains('chat-date-separator')) {
            prevElement.remove()
          }
        }
      }
      firstMessage.remove()
      this.messageCount--
    }
  }

  /**
   * Add multiple messages (for history loading)
   */
  addMessages(messages: Message[], prepend = false): void {
    if (messages.length === 0) return

    this.hideEmptyState()
    this.hideLoading()

    const fragment = document.createDocumentFragment()
    let currentDate = prepend ? '' : this.lastMessageDate

    // Sort messages by date
    const sortedMessages = [...messages].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    sortedMessages.forEach(message => {
      const messageDate = formatDate(message.timestamp)
      if (messageDate !== currentDate) {
        fragment.appendChild(this.createDateSeparatorElement(messageDate))
        currentDate = messageDate
      }
      fragment.appendChild(this.createMessageElement(message))
    })

    if (prepend) {
      const scrollHeight = this.element.scrollHeight
      this.element.insertBefore(fragment, this.element.firstChild)
      // Maintain scroll position when prepending
      this.element.scrollTop = this.element.scrollHeight - scrollHeight
    } else {
      this.lastMessageDate = currentDate
      if (this.typingIndicator) {
        this.element.insertBefore(fragment, this.typingIndicator)
      } else {
        this.element.appendChild(fragment)
      }
      scrollToBottom(this.element, false)
    }

    // Update message count and enforce limit
    this.messageCount += sortedMessages.length
    while (this.messageCount > this.maxMessages) {
      this.removeOldestMessage()
    }
  }

  /**
   * Update message status
   */
  updateMessageStatus(messageId: string, status: MessageStatus): void {
    const messageEl = this.element.querySelector(`[data-message-id="${messageId}"]`)
    if (messageEl) {
      const statusEl = messageEl.querySelector('.chat-message__status')
      if (statusEl) {
        statusEl.innerHTML = this.getStatusIcon(status)
        statusEl.className = `chat-message__status chat-message__status--${status}`
      }
    }
  }

  /**
   * Remove temporary message (when confirmed by server)
   */
  removeMessage(messageId: string): void {
    const messageEl = this.element.querySelector(`[data-message-id="${messageId}"]`)
    if (messageEl) {
      messageEl.remove()
    }
  }

  /**
   * Show typing indicator
   */
  showTyping(): void {
    if (this.typingIndicator) return

    this.typingIndicator = createElement('div', { className: 'chat-typing' })

    const dots = createElement('div', { className: 'chat-typing__dots' })
    dots.appendChild(createElement('span', { className: 'chat-typing__dot' }))
    dots.appendChild(createElement('span', { className: 'chat-typing__dot' }))
    dots.appendChild(createElement('span', { className: 'chat-typing__dot' }))

    this.typingIndicator.appendChild(dots)
    this.typingIndicator.appendChild(document.createTextNode('Оператор печатает...'))

    this.element.appendChild(this.typingIndicator)

    if (this.autoScroll) {
      scrollToBottom(this.element)
    }
  }

  /**
   * Hide typing indicator
   */
  hideTyping(): void {
    if (this.typingIndicator) {
      this.typingIndicator.remove()
      this.typingIndicator = null
    }
  }

  /**
   * Show empty state
   */
  showEmptyState(): void {
    if (this.emptyState) return

    this.emptyState = createElement('div', { className: 'chat-empty' })

    const icon = createElement('div', { className: 'chat-empty__icon' })
    icon.innerHTML = icons.chat
    this.emptyState.appendChild(icon)

    const title = createElement('h3', { className: 'chat-empty__title' }, [
      'Добро пожаловать!'
    ])
    this.emptyState.appendChild(title)

    const text = createElement('p', { className: 'chat-empty__text' }, [
      'Напишите нам, и мы ответим как можно скорее.'
    ])
    this.emptyState.appendChild(text)

    this.element.appendChild(this.emptyState)
  }

  /**
   * Hide empty state
   */
  hideEmptyState(): void {
    if (this.emptyState) {
      this.emptyState.remove()
      this.emptyState = null
    }
  }

  /**
   * Show loading state
   */
  showLoading(): void {
    if (this.loadingState) return

    this.loadingState = createElement('div', { className: 'chat-loading' })
    const spinner = createElement('div', { className: 'chat-loading__spinner' })
    this.loadingState.appendChild(spinner)
    this.element.appendChild(this.loadingState)
  }

  /**
   * Hide loading state
   */
  hideLoading(): void {
    if (this.loadingState) {
      this.loadingState.remove()
      this.loadingState = null
    }
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.element.innerHTML = ''
    this.typingIndicator = null
    this.emptyState = null
    this.loadingState = null
    this.lastMessageDate = ''
    this.showEmptyState()
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.unsubscribe.forEach(fn => fn())
    this.element.remove()
  }

  private createContainer(): HTMLElement {
    return createElement('div', {
      className: 'chat-messages',
      role: 'log',
      'aria-live': 'polite',
      'aria-label': 'Сообщения чата'
    })
  }

  private setupScrollListener(): void {
    const handleScroll = () => {
      // Update auto-scroll flag based on scroll position
      this.autoScroll = isScrolledToBottom(this.element)

      // Trigger load more when scrolled to top
      if (this.element.scrollTop < 100 && this.options.onScrollTop) {
        this.options.onScrollTop()
      }
    }

    const unsub = on(this.element, 'scroll', handleScroll, { passive: true })
    this.unsubscribe.push(unsub)
  }

  private createMessageElement(message: Message): HTMLElement {
    const isUser = message.from === 'user'

    const wrapper = createElement('div', {
      className: `chat-message chat-message--${message.from}`,
      'data-message-id': message.id
    })

    // Message bubble
    const bubble = createElement('div', { className: 'chat-message__bubble' })

    // Add image if present
    if (message.imageUrl) {
      const img = createElement('img', {
        className: 'chat-message__image',
        src: message.imageUrl,
        alt: 'Изображение'
      }) as HTMLImageElement
      img.loading = 'lazy'
      img.onclick = () => window.open(message.imageUrl, '_blank')
      bubble.appendChild(img)
    }

    // Add voice player if present
    if (message.voiceUrl) {
      const voiceContainer = this.createVoicePlayer(message.voiceUrl, message.voiceDuration)
      bubble.appendChild(voiceContainer)
    }

    // Add text if present
    if (message.text) {
      const textEl = createElement('div', { className: 'chat-message__text' })
      textEl.innerHTML = formatMessageText(message.text)
      bubble.appendChild(textEl)
    }

    wrapper.appendChild(bubble)

    // Time and status
    const meta = createElement('div', { className: 'chat-message__meta' })

    const time = createElement('span', { className: 'chat-message__time' }, [
      formatTime(message.timestamp)
    ])
    meta.appendChild(time)

    if (isUser && message.status) {
      const status = createElement('span', {
        className: `chat-message__status chat-message__status--${message.status}`
      })
      status.innerHTML = this.getStatusIcon(message.status)
      meta.appendChild(status)
    }

    wrapper.appendChild(meta)

    return wrapper
  }

  private createDateSeparatorElement(dateText: string): HTMLElement {
    const separator = createElement('div', { className: 'chat-date-separator' })
    const text = createElement('span', { className: 'chat-date-separator__text' }, [dateText])
    separator.appendChild(text)
    return separator
  }

  private addDateSeparator(dateText: string): void {
    const separator = this.createDateSeparatorElement(dateText)
    if (this.typingIndicator) {
      this.element.insertBefore(separator, this.typingIndicator)
    } else {
      this.element.appendChild(separator)
    }
  }

  private getStatusIcon(status: MessageStatus): string {
    switch (status) {
      case 'sending':
        return icons.clock
      case 'sent':
        return icons.check
      case 'delivered':
        return icons.doubleCheck
      case 'failed':
        return icons.error
      default:
        return ''
    }
  }

  private createVoicePlayer(url: string, duration?: number): HTMLElement {
    const container = createElement('div', { className: 'chat-message__voice' })

    // Play button
    const playBtn = createElement('button', {
      className: 'chat-message__voice-btn',
      'aria-label': 'Воспроизвести'
    })
    playBtn.innerHTML = icons.play

    // Progress bar
    const progress = createElement('div', { className: 'chat-message__voice-progress' })
    const progressBar = createElement('div', { className: 'chat-message__voice-progress-bar' })
    progress.appendChild(progressBar)

    // Duration text
    const durationText = createElement('span', { className: 'chat-message__voice-duration' }, [
      this.formatDuration(duration || 0)
    ])

    container.appendChild(playBtn)
    container.appendChild(progress)
    container.appendChild(durationText)

    // Audio element (hidden)
    const audio = new Audio(url)
    audio.preload = 'metadata'

    let isPlaying = false

    playBtn.onclick = () => {
      if (isPlaying) {
        audio.pause()
        playBtn.innerHTML = icons.play
        isPlaying = false
      } else {
        audio.play()
        playBtn.innerHTML = icons.pause
        isPlaying = true
      }
    }

    audio.ontimeupdate = () => {
      const percent = (audio.currentTime / audio.duration) * 100
      ;(progressBar as HTMLElement).style.width = `${percent}%`
      durationText.textContent = this.formatDuration(audio.currentTime)
    }

    audio.onended = () => {
      playBtn.innerHTML = icons.play
      isPlaying = false
      ;(progressBar as HTMLElement).style.width = '0%'
      durationText.textContent = this.formatDuration(duration || 0)
    }

    return container
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
}

/**
 * Message input component
 */

import { createElement, on, debounce } from '../utils/dom'
import { sanitizeInput } from '../utils/escape'
import { saveDraft, loadDraft, clearDraft } from '../utils/storage'
import { icons } from './icons'

export interface ChatInputOptions {
  placeholder?: string
  maxLength?: number
  onSend?: (text: string) => void
  onTyping?: (isTyping: boolean) => void
  enableDraft?: boolean
}

export class ChatInput {
  private element: HTMLElement
  private textarea: HTMLTextAreaElement
  private sendButton: HTMLButtonElement
  private isTyping = false
  private typingTimeout: ReturnType<typeof setTimeout> | null = null
  private unsubscribe: (() => void)[] = []

  constructor(private options: ChatInputOptions = {}) {
    this.element = this.createContainer()
    this.textarea = this.element.querySelector('.chat-input__field') as HTMLTextAreaElement
    this.sendButton = this.element.querySelector('.chat-input__btn') as HTMLButtonElement
    this.setupEventListeners()
    this.loadDraftMessage()
  }

  /**
   * Get container element
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * Focus input
   */
  focus(): void {
    this.textarea.focus()
  }

  /**
   * Clear input
   */
  clear(): void {
    this.textarea.value = ''
    this.updateSendButton()
    this.adjustHeight()
    if (this.options.enableDraft !== false) {
      clearDraft()
    }
  }

  /**
   * Set input value
   */
  setValue(text: string): void {
    this.textarea.value = text
    this.updateSendButton()
    this.adjustHeight()
  }

  /**
   * Get input value
   */
  getValue(): string {
    return this.textarea.value.trim()
  }

  /**
   * Disable input
   */
  disable(): void {
    this.textarea.disabled = true
    this.sendButton.disabled = true
  }

  /**
   * Enable input
   */
  enable(): void {
    this.textarea.disabled = false
    this.updateSendButton()
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.saveDraftMessage()
    this.unsubscribe.forEach(fn => fn())
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
    }
    this.element.remove()
  }

  private createContainer(): HTMLElement {
    const container = createElement('div', { className: 'chat-input' })

    // Textarea
    const textarea = createElement('textarea', {
      className: 'chat-input__field',
      placeholder: this.options.placeholder || 'Введите сообщение...',
      rows: '1',
      'aria-label': 'Сообщение'
    }) as HTMLTextAreaElement

    if (this.options.maxLength) {
      textarea.setAttribute('maxlength', String(this.options.maxLength))
    }

    container.appendChild(textarea)

    // Send button
    const sendBtn = createElement('button', {
      className: 'chat-input__btn',
      type: 'button',
      'aria-label': 'Отправить',
      disabled: 'true'
    }) as HTMLButtonElement

    const iconWrapper = document.createElement('div')
    iconWrapper.innerHTML = icons.send
    const svg = iconWrapper.firstElementChild
    if (svg) {
      sendBtn.appendChild(svg)
    }

    container.appendChild(sendBtn)

    return container
  }

  private setupEventListeners(): void {
    // Input handler
    const handleInput = () => {
      this.updateSendButton()
      this.adjustHeight()
      this.handleTypingIndicator()
      this.debouncedSaveDraft()
    }

    const inputUnsub = on(this.textarea, 'input', handleInput)
    this.unsubscribe.push(inputUnsub)

    // Send on button click
    const sendUnsub = on(this.sendButton, 'click', () => this.sendMessage())
    this.unsubscribe.push(sendUnsub)

    // Send on Enter (without Shift)
    const keydownUnsub = on(this.textarea, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })
    this.unsubscribe.push(keydownUnsub)

    // Stop typing on blur
    const blurUnsub = on(this.textarea, 'blur', () => {
      this.stopTyping()
    })
    this.unsubscribe.push(blurUnsub)
  }

  private sendMessage(): void {
    const text = sanitizeInput(this.textarea.value)
    if (!text) return

    if (this.options.onSend) {
      this.options.onSend(text)
    }

    this.clear()
    this.stopTyping()
  }

  private updateSendButton(): void {
    const hasContent = this.textarea.value.trim().length > 0
    this.sendButton.disabled = !hasContent || this.textarea.disabled
  }

  private adjustHeight(): void {
    // Reset height to get accurate scrollHeight
    this.textarea.style.height = 'auto'

    // Calculate new height
    const maxHeight = 120 // Match CSS max-height
    const newHeight = Math.min(this.textarea.scrollHeight, maxHeight)

    this.textarea.style.height = `${newHeight}px`
  }

  private handleTypingIndicator(): void {
    if (!this.options.onTyping) return

    const hasContent = this.textarea.value.trim().length > 0

    if (hasContent && !this.isTyping) {
      this.isTyping = true
      this.options.onTyping(true)
    }

    // Reset typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
    }

    // Stop typing after 3 seconds of inactivity
    this.typingTimeout = setTimeout(() => {
      this.stopTyping()
    }, 3000)
  }

  private stopTyping(): void {
    if (this.isTyping && this.options.onTyping) {
      this.isTyping = false
      this.options.onTyping(false)
    }

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout)
      this.typingTimeout = null
    }
  }

  private debouncedSaveDraft = debounce(() => {
    this.saveDraftMessage()
  }, 500)

  private saveDraftMessage(): void {
    if (this.options.enableDraft !== false) {
      saveDraft(this.textarea.value)
    }
  }

  private loadDraftMessage(): void {
    if (this.options.enableDraft !== false) {
      const draft = loadDraft()
      if (draft) {
        this.textarea.value = draft
        this.updateSendButton()
        this.adjustHeight()
      }
    }
  }
}

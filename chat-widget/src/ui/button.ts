/**
 * Floating action button component
 */

import { createElement, on } from '../utils/dom'
import { icons } from './icons'

export interface ChatButtonOptions {
  position?: 'bottom-right' | 'bottom-left'
  onClick?: () => void
}

export class ChatButton {
  private element: HTMLButtonElement
  private badge: HTMLSpanElement | null = null
  private unsubscribe: (() => void)[] = []

  constructor(private options: ChatButtonOptions = {}) {
    this.element = this.createButton()
    this.setupEventListeners()
  }

  /**
   * Get button element
   */
  getElement(): HTMLButtonElement {
    return this.element
  }

  /**
   * Show button
   */
  show(): void {
    this.element.classList.remove('chat-button--hidden')
  }

  /**
   * Hide button
   */
  hide(): void {
    this.element.classList.add('chat-button--hidden')
  }

  /**
   * Set unread count badge
   */
  setUnreadCount(count: number): void {
    if (count > 0) {
      if (!this.badge) {
        this.badge = createElement('span', {
          className: 'chat-button__badge'
        })
        this.element.appendChild(this.badge)
      }
      this.badge.textContent = count > 99 ? '99+' : String(count)
      this.element.classList.add('chat-button--notify')
    } else {
      if (this.badge) {
        this.badge.remove()
        this.badge = null
      }
      this.element.classList.remove('chat-button--notify')
    }
  }

  /**
   * Enable pulse animation
   */
  enablePulse(): void {
    this.element.classList.add('chat-button--notify')
  }

  /**
   * Disable pulse animation
   */
  disablePulse(): void {
    if (!this.badge) {
      this.element.classList.remove('chat-button--notify')
    }
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.unsubscribe.forEach(fn => fn())
    this.element.remove()
  }

  private createButton(): HTMLButtonElement {
    const button = createElement('button', {
      className: 'chat-button',
      'aria-label': 'Открыть чат поддержки',
      type: 'button'
    }) as HTMLButtonElement

    // Add chat icon
    const iconWrapper = document.createElement('div')
    iconWrapper.innerHTML = icons.chat
    const svg = iconWrapper.firstElementChild
    if (svg) {
      button.appendChild(svg)
    }

    // Apply position
    if (this.options.position === 'bottom-left') {
      button.style.left = '20px'
      button.style.right = 'auto'
    }

    return button
  }

  private setupEventListeners(): void {
    if (this.options.onClick) {
      const unsub = on(this.element, 'click', this.options.onClick)
      this.unsubscribe.push(unsub)
    }

    // Keyboard accessibility
    const keyboardHandler = on(this.element, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.element.click()
      }
    })
    this.unsubscribe.push(keyboardHandler)
  }
}

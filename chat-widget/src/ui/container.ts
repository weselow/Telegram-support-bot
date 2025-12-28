/**
 * Chat container component (modal and drawer variants)
 */

import { createElement, on, loadCSS } from '../utils/dom'
import type { WidgetVariant } from '../types/config'

export interface ContainerOptions {
  variant: WidgetVariant
  baseUrl: string
  onClose?: () => void
  onOverlayClick?: () => void
}

export class ChatContainer {
  private wrapper: HTMLElement
  private container: HTMLElement
  private overlay: HTMLElement | null = null
  private isOpen = false
  private cssLoaded = false
  private unsubscribe: (() => void)[] = []

  constructor(private options: ContainerOptions) {
    this.wrapper = this.createWrapper()
    this.container = this.createContainer()

    if (options.variant === 'drawer') {
      this.overlay = this.createOverlay()
      this.wrapper.appendChild(this.overlay)
    }

    this.wrapper.appendChild(this.container)
    this.loadVariantCSS()
  }

  /**
   * Get wrapper element (to append to DOM)
   */
  getWrapper(): HTMLElement {
    return this.wrapper
  }

  /**
   * Get container element (to append content)
   */
  getContainer(): HTMLElement {
    return this.container
  }

  /**
   * Open container with animation
   */
  open(): void {
    if (this.isOpen) return

    this.isOpen = true
    this.wrapper.style.display = 'block'

    // Trigger reflow for animation
    void this.container.offsetHeight

    if (this.options.variant === 'drawer') {
      this.overlay?.classList.add('chat-overlay--visible')
      this.container.classList.add('chat-container--open')
      document.body.style.overflow = 'hidden'
    }
  }

  /**
   * Close container with animation
   */
  close(): void {
    if (!this.isOpen) return

    this.isOpen = false

    if (this.options.variant === 'drawer') {
      this.overlay?.classList.remove('chat-overlay--visible')
      this.container.classList.remove('chat-container--open')
      document.body.style.overflow = ''

      // Hide after animation
      setTimeout(() => {
        if (!this.isOpen) {
          this.wrapper.style.display = 'none'
        }
      }, 350) // Match CSS transition duration
    } else {
      // Modal: add closing animation
      this.container.classList.add('chat-container--closing')

      setTimeout(() => {
        if (!this.isOpen) {
          this.container.classList.remove('chat-container--closing')
          this.wrapper.style.display = 'none'
        }
      }, 250) // Match CSS animation duration
    }
  }

  /**
   * Check if open
   */
  isOpened(): boolean {
    return this.isOpen
  }

  /**
   * Toggle open/close
   */
  toggle(): void {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.unsubscribe.forEach(fn => fn())
    if (this.options.variant === 'drawer') {
      document.body.style.overflow = ''
    }
    this.wrapper.remove()
  }

  private createWrapper(): HTMLElement {
    const variantClass = `chat-widget--${this.options.variant}`

    return createElement('div', {
      className: `chat-widget ${variantClass}`
    })
  }

  private createContainer(): HTMLElement {
    return createElement('div', {
      className: 'chat-container',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Чат поддержки'
    })
  }

  private createOverlay(): HTMLElement {
    const overlay = createElement('div', {
      className: 'chat-overlay',
      'aria-hidden': 'true'
    })

    // Close on overlay click
    const clickHandler = on(overlay, 'click', () => {
      if (this.options.onOverlayClick) {
        this.options.onOverlayClick()
      } else if (this.options.onClose) {
        this.options.onClose()
      }
    })
    this.unsubscribe.push(clickHandler)

    return overlay
  }

  private async loadVariantCSS(): Promise<void> {
    if (this.cssLoaded) return

    try {
      const cssFile = this.options.variant === 'drawer' ? 'drawer.css' : 'modal.css'
      await loadCSS(`${this.options.baseUrl}/${cssFile}`)
      this.cssLoaded = true
    } catch (error) {
      console.error(`[ChatWidget] Failed to load ${this.options.variant} CSS:`, error)
    }
  }
}

/**
 * Connection status component
 */

import { createElement } from '../utils/dom'
import type { ConnectionState } from '../transport/websocket'

export type StatusType = 'connecting' | 'reconnecting' | 'disconnected' | 'error'

export interface StatusBarOptions {
  onRetry?: () => void
}

export class StatusBar {
  private element: HTMLElement | null = null
  private currentType: StatusType | null = null

  constructor(private container: HTMLElement, private options: StatusBarOptions = {}) {}

  /**
   * Show status bar with message
   */
  show(type: StatusType, message?: string): void {
    if (this.currentType === type) return

    this.hide()

    this.currentType = type
    this.element = this.createStatusBar(type, message)
    this.container.prepend(this.element)
  }

  /**
   * Hide status bar
   */
  hide(): void {
    if (this.element) {
      this.element.remove()
      this.element = null
      this.currentType = null
    }
  }

  /**
   * Update from connection state
   */
  updateFromConnectionState(state: ConnectionState): void {
    switch (state) {
      case 'connecting':
        this.show('connecting', 'Подключение...')
        break
      case 'reconnecting':
        this.show('reconnecting', 'Переподключение...')
        break
      case 'disconnected':
        this.show('disconnected', 'Соединение потеряно')
        break
      case 'connected':
        this.hide()
        break
    }
  }

  /**
   * Show error
   */
  showError(message: string): void {
    this.show('error', message)
  }

  private createStatusBar(type: StatusType, message?: string): HTMLElement {
    const statusBar = createElement('div', {
      className: `chat-status chat-status--${type}`,
      role: 'status',
      'aria-live': 'polite'
    })

    // Spinner for connecting states
    if (type === 'connecting' || type === 'reconnecting') {
      const spinner = createElement('div', { className: 'chat-status__spinner' })
      statusBar.appendChild(spinner)
    }

    // Message text
    const text = document.createTextNode(message || this.getDefaultMessage(type))
    statusBar.appendChild(text)

    // Retry button for error state
    if (type === 'error' && this.options.onRetry) {
      const retryBtn = createElement('button', {
        className: 'chat-status__retry',
        type: 'button'
      }, ['Повторить'])

      retryBtn.addEventListener('click', () => {
        this.options.onRetry?.()
      })

      statusBar.appendChild(retryBtn)
    }

    return statusBar
  }

  private getDefaultMessage(type: StatusType): string {
    switch (type) {
      case 'connecting':
        return 'Подключение...'
      case 'reconnecting':
        return 'Переподключение...'
      case 'disconnected':
        return 'Соединение потеряно'
      case 'error':
        return 'Ошибка подключения'
    }
  }
}

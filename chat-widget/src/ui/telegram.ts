/**
 * Telegram link component
 */

import { createElement, on } from '../utils/dom'
import { icons } from './icons'

export interface TelegramLinkOptions {
  onLink?: () => void
}

export class TelegramLink {
  private element: HTMLElement
  private statusText: HTMLSpanElement
  private linkButton: HTMLButtonElement
  private isLinked = false
  private linkedUsername = ''
  private unsubscribe: (() => void)[] = []

  constructor(private options: TelegramLinkOptions = {}) {
    this.element = this.createContainer()
    this.statusText = this.element.querySelector('.chat-telegram__text') as HTMLSpanElement
    this.linkButton = this.element.querySelector('.chat-telegram__btn') as HTMLButtonElement
    this.setupEventListeners()
  }

  /**
   * Get container element
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * Show component
   */
  show(): void {
    this.element.style.display = 'flex'
  }

  /**
   * Hide component
   */
  hide(): void {
    this.element.style.display = 'none'
  }

  /**
   * Set linked state
   */
  setLinked(username: string): void {
    this.isLinked = true
    this.linkedUsername = username
    this.updateUI()
  }

  /**
   * Set unlinked state
   */
  setUnlinked(): void {
    this.isLinked = false
    this.linkedUsername = ''
    this.updateUI()
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    this.linkButton.disabled = loading
    if (loading) {
      this.linkButton.textContent = 'Загрузка...'
    } else {
      this.updateUI()
    }
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.unsubscribe.forEach(fn => fn())
    this.element.remove()
  }

  private createContainer(): HTMLElement {
    const container = createElement('div', { className: 'chat-telegram' })

    // Status text
    const text = createElement('span', { className: 'chat-telegram__text' }, [
      'Продолжить в Telegram?'
    ])
    container.appendChild(text)

    // Link button
    const btn = createElement('button', {
      className: 'chat-telegram__btn',
      type: 'button'
    }) as HTMLButtonElement

    // Telegram icon
    const iconWrapper = document.createElement('div')
    iconWrapper.innerHTML = icons.telegram
    const svg = iconWrapper.firstElementChild
    if (svg) {
      btn.appendChild(svg)
    }

    btn.appendChild(document.createTextNode('Подключить'))
    container.appendChild(btn)

    // Initially hidden
    container.style.display = 'none'

    return container
  }

  private setupEventListeners(): void {
    const clickHandler = on(this.linkButton, 'click', () => {
      if (!this.isLinked && this.options.onLink) {
        this.options.onLink()
      }
    })
    this.unsubscribe.push(clickHandler)
  }

  private updateUI(): void {
    if (this.isLinked) {
      this.statusText.textContent = `Связан с @${this.linkedUsername}`
      this.linkButton.style.display = 'none'
    } else {
      this.statusText.textContent = 'Продолжить в Telegram?'
      this.linkButton.style.display = 'flex'
      this.linkButton.innerHTML = ''

      const iconWrapper = document.createElement('div')
      iconWrapper.innerHTML = icons.telegram
      const svg = iconWrapper.firstElementChild
      if (svg) {
        this.linkButton.appendChild(svg)
      }
      this.linkButton.appendChild(document.createTextNode('Подключить'))
    }
  }
}

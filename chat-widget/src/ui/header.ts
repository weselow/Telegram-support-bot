/**
 * Chat header component
 */

import { createElement, on } from '../utils/dom'
import { icons } from './icons'

export interface ChatHeaderOptions {
  title?: string
  subtitle?: string
  onClose?: () => void
  onMinimize?: () => void
  onMenu?: () => void
  showMinimize?: boolean
  showMenu?: boolean
}

export class ChatHeader {
  private element: HTMLElement
  private subtitleElement: HTMLParagraphElement | null = null
  private unsubscribe: (() => void)[] = []

  constructor(private options: ChatHeaderOptions = {}) {
    this.element = this.createHeader()
  }

  /**
   * Get header element
   */
  getElement(): HTMLElement {
    return this.element
  }

  /**
   * Update subtitle text
   */
  setSubtitle(text: string): void {
    if (this.subtitleElement) {
      this.subtitleElement.textContent = text
    }
  }

  /**
   * Destroy component
   */
  destroy(): void {
    this.unsubscribe.forEach(fn => fn())
    this.element.remove()
  }

  private createHeader(): HTMLElement {
    const header = createElement('header', {
      className: 'chat-header'
    })

    // Info section (avatar + text)
    const info = createElement('div', { className: 'chat-header__info' })

    // Avatar
    const avatar = createElement('div', { className: 'chat-header__avatar' })
    const avatarIcon = document.createElement('div')
    avatarIcon.innerHTML = icons.support
    const avatarSvg = avatarIcon.firstElementChild
    if (avatarSvg) {
      avatar.appendChild(avatarSvg)
    }
    info.appendChild(avatar)

    // Text container
    const textContainer = createElement('div', { className: 'chat-header__text' })

    // Title
    const title = createElement('h2', { className: 'chat-header__title' }, [
      this.options.title || 'Поддержка DellShop'
    ])
    textContainer.appendChild(title)

    // Subtitle
    this.subtitleElement = createElement('p', { className: 'chat-header__subtitle' }, [
      this.options.subtitle || 'Мы онлайн'
    ]) as HTMLParagraphElement
    textContainer.appendChild(this.subtitleElement)

    info.appendChild(textContainer)
    header.appendChild(info)

    // Actions
    const actions = createElement('div', { className: 'chat-header__actions' })

    // Menu button (optional)
    if (this.options.showMenu && this.options.onMenu) {
      const menuBtn = this.createActionButton('menu', 'Меню', this.options.onMenu)
      actions.appendChild(menuBtn)
    }

    // Minimize button (optional)
    if (this.options.showMinimize && this.options.onMinimize) {
      const minimizeBtn = this.createActionButton('minimize', 'Свернуть', this.options.onMinimize)
      actions.appendChild(minimizeBtn)
    }

    // Close button
    if (this.options.onClose) {
      const closeBtn = this.createActionButton('close', 'Закрыть', this.options.onClose)
      closeBtn.classList.add('chat-header__btn--close')
      actions.appendChild(closeBtn)
    }

    header.appendChild(actions)

    return header
  }

  private createActionButton(
    iconName: keyof typeof icons,
    label: string,
    onClick: () => void
  ): HTMLButtonElement {
    const btn = createElement('button', {
      className: 'chat-header__btn',
      'aria-label': label,
      type: 'button'
    }) as HTMLButtonElement

    const iconWrapper = document.createElement('div')
    iconWrapper.innerHTML = icons[iconName]
    const svg = iconWrapper.firstElementChild
    if (svg) {
      btn.appendChild(svg)
    }

    const unsub = on(btn, 'click', onClick)
    this.unsubscribe.push(unsub)

    return btn
  }
}

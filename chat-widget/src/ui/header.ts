/**
 * Chat header component
 */

import { createElement, on } from '../utils/dom'
import { icons } from './icons'

export interface ChatHeaderOptions {
  title?: string
  subtitle?: string
  avatarUrl?: string | null
  onClose?: () => void
  onMinimize?: () => void
  onMenu?: () => void
  onToggleVariant?: () => void
  showMinimize?: boolean
  showMenu?: boolean
  showToggleVariant?: boolean
  variant?: 'modal' | 'drawer'
}

export class ChatHeader {
  private element: HTMLElement
  private titleElement: HTMLHeadingElement | null = null
  private subtitleElement: HTMLParagraphElement | null = null
  private avatarElement: HTMLDivElement | null = null
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
   * Update title text
   */
  setTitle(text: string): void {
    if (this.titleElement) {
      this.titleElement.textContent = text
    }
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
   * Update avatar image
   */
  setAvatar(url: string): void {
    if (!this.avatarElement) return

    // Clear current content
    this.avatarElement.innerHTML = ''

    const img = createElement('img', {
      src: url,
      alt: 'Avatar',
      className: 'chat-header__avatar-img'
    }) as HTMLImageElement
    img.onerror = () => {
      // Fallback to icon on error
      img.remove()
      const iconWrapper = document.createElement('div')
      iconWrapper.innerHTML = icons.support
      const svg = iconWrapper.firstElementChild
      if (svg && this.avatarElement) this.avatarElement.appendChild(svg)
    }
    this.avatarElement.appendChild(img)
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
    this.avatarElement = createElement('div', { className: 'chat-header__avatar' }) as HTMLDivElement
    if (this.options.avatarUrl) {
      const img = createElement('img', {
        src: this.options.avatarUrl,
        alt: this.options.title || 'Avatar',
        className: 'chat-header__avatar-img'
      }) as HTMLImageElement
      img.onerror = () => {
        // Fallback to icon on error
        img.remove()
        const iconWrapper = document.createElement('div')
        iconWrapper.innerHTML = icons.support
        const svg = iconWrapper.firstElementChild
        if (svg && this.avatarElement) this.avatarElement.appendChild(svg)
      }
      this.avatarElement.appendChild(img)
    } else {
      const avatarIcon = document.createElement('div')
      avatarIcon.innerHTML = icons.support
      const avatarSvg = avatarIcon.firstElementChild
      if (avatarSvg) {
        this.avatarElement.appendChild(avatarSvg)
      }
    }
    info.appendChild(this.avatarElement)

    // Text container
    const textContainer = createElement('div', { className: 'chat-header__text' })

    // Title
    this.titleElement = createElement('h2', { className: 'chat-header__title' }, [
      this.options.title || 'Поддержка DellShop'
    ]) as HTMLHeadingElement
    textContainer.appendChild(this.titleElement)

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

    // Minimize button (optional, desktop only)
    if (this.options.showMinimize && this.options.onMinimize) {
      const minimizeBtn = this.createActionButton('minimize', 'Свернуть', this.options.onMinimize)
      minimizeBtn.classList.add('chat-header__btn--desktop-only')
      actions.appendChild(minimizeBtn)
    }

    // Toggle variant button (optional, desktop only)
    if (this.options.showToggleVariant && this.options.onToggleVariant) {
      const isModal = this.options.variant === 'modal'
      const iconName = isModal ? 'windowMaximize' : 'windowRestore'
      const label = isModal ? 'Развернуть' : 'Восстановить'
      const toggleBtn = this.createActionButton(iconName, label, this.options.onToggleVariant)
      toggleBtn.classList.add('chat-header__btn--desktop-only')
      actions.appendChild(toggleBtn)
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TelegramLink } from '../../ui/telegram'

describe('TelegramLink', () => {
  let telegramLink: TelegramLink

  afterEach(() => {
    telegramLink?.destroy()
  })

  describe('initial state', () => {
    it('should be hidden by default', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()

      expect(element.style.display).toBe('none')
    })

    it('should show "Перейти" button when unlinked', () => {
      telegramLink = new TelegramLink()
      telegramLink.show()
      const element = telegramLink.getElement()

      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement
      expect(button).toBeTruthy()
      expect(button.style.display).not.toBe('none')
      expect(button.textContent).toContain('Перейти')
    })

    it('should show default text when unlinked', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()

      const text = element.querySelector('.chat-telegram__text')
      expect(text?.textContent).toBe('Продолжить в Telegram?')
    })
  })

  describe('setLinked', () => {
    it('should hide button when linked', () => {
      telegramLink = new TelegramLink()
      telegramLink.show()
      telegramLink.setLinked('testuser')
      const element = telegramLink.getElement()

      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement
      expect(button.style.display).toBe('none')
    })

    it('should display username when linked', () => {
      telegramLink = new TelegramLink()
      telegramLink.setLinked('myusername')
      const element = telegramLink.getElement()

      const text = element.querySelector('.chat-telegram__text')
      expect(text?.textContent).toBe('Связан с @myusername')
    })
  })

  describe('setUnlinked', () => {
    it('should show button after unlinking', () => {
      telegramLink = new TelegramLink()
      telegramLink.setLinked('testuser')
      telegramLink.setUnlinked()
      const element = telegramLink.getElement()

      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement
      expect(button.style.display).toBe('flex')
    })

    it('should restore default text after unlinking', () => {
      telegramLink = new TelegramLink()
      telegramLink.setLinked('testuser')
      telegramLink.setUnlinked()
      const element = telegramLink.getElement()

      const text = element.querySelector('.chat-telegram__text')
      expect(text?.textContent).toBe('Продолжить в Telegram?')
    })
  })

  describe('setLoading', () => {
    it('should disable button during loading', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()
      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement

      telegramLink.setLoading(true)

      expect(button.disabled).toBe(true)
      expect(button.textContent).toBe('Загрузка...')
    })

    it('should enable button after loading ends', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()
      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement

      telegramLink.setLoading(true)
      telegramLink.setLoading(false)

      expect(button.disabled).toBe(false)
      expect(button.textContent).toContain('Перейти')
    })
  })

  describe('onLink callback', () => {
    it('should call onLink callback when button clicked and unlinked', () => {
      const onLink = vi.fn()
      telegramLink = new TelegramLink({ onLink })
      const element = telegramLink.getElement()
      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement

      button.click()

      expect(onLink).toHaveBeenCalledTimes(1)
    })

    it('should not call onLink callback when linked', () => {
      const onLink = vi.fn()
      telegramLink = new TelegramLink({ onLink })
      telegramLink.setLinked('testuser')
      const element = telegramLink.getElement()
      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement

      button.click()

      expect(onLink).not.toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()
      document.body.appendChild(element)

      expect(document.body.contains(element)).toBe(true)

      telegramLink.destroy()

      expect(document.body.contains(element)).toBe(false)
    })

    it('should cleanup event listeners on destroy', () => {
      const onLink = vi.fn()
      telegramLink = new TelegramLink({ onLink })
      const element = telegramLink.getElement()
      const button = element.querySelector('.chat-telegram__btn') as HTMLButtonElement

      telegramLink.destroy()

      // After destroy, clicking should not trigger callback
      // Note: The element is removed, but we can still dispatch event
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(onLink).not.toHaveBeenCalled()
    })
  })

  describe('show/hide', () => {
    it('should show element', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()

      telegramLink.show()

      expect(element.style.display).toBe('flex')
    })

    it('should hide element', () => {
      telegramLink = new TelegramLink()
      const element = telegramLink.getElement()

      telegramLink.show()
      telegramLink.hide()

      expect(element.style.display).toBe('none')
    })
  })
})

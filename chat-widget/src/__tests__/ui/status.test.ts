import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StatusBar } from '../../ui/status'

describe('StatusBar', () => {
  let container: HTMLElement
  let statusBar: StatusBar

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    statusBar?.hide()
    container.remove()
  })

  describe('show', () => {
    it('should show connecting status with spinner', () => {
      statusBar = new StatusBar(container)

      statusBar.show('connecting', 'Подключение...')

      const status = container.querySelector('.chat-status')
      expect(status).toBeTruthy()
      expect(status?.classList.contains('chat-status--connecting')).toBe(true)
      expect(status?.textContent).toContain('Подключение...')

      const spinner = container.querySelector('.chat-status__spinner')
      expect(spinner).toBeTruthy()
    })

    it('should show reconnecting status with spinner', () => {
      statusBar = new StatusBar(container)

      statusBar.show('reconnecting', 'Переподключение...')

      const status = container.querySelector('.chat-status')
      expect(status?.classList.contains('chat-status--reconnecting')).toBe(true)

      const spinner = container.querySelector('.chat-status__spinner')
      expect(spinner).toBeTruthy()
    })

    it('should show disconnected status without spinner', () => {
      statusBar = new StatusBar(container)

      statusBar.show('disconnected', 'Соединение потеряно')

      const status = container.querySelector('.chat-status')
      expect(status?.classList.contains('chat-status--disconnected')).toBe(true)

      const spinner = container.querySelector('.chat-status__spinner')
      expect(spinner).toBeNull()
    })

    it('should show error status with retry button', () => {
      const onRetry = vi.fn()
      statusBar = new StatusBar(container, { onRetry })

      statusBar.show('error', 'Ошибка подключения')

      const status = container.querySelector('.chat-status')
      expect(status?.classList.contains('chat-status--error')).toBe(true)

      const retryBtn = container.querySelector('.chat-status__retry')
      expect(retryBtn).toBeTruthy()
      expect(retryBtn?.textContent).toBe('Повторить')
    })

    it('should not show retry button if no onRetry callback', () => {
      statusBar = new StatusBar(container)

      statusBar.show('error', 'Ошибка подключения')

      const retryBtn = container.querySelector('.chat-status__retry')
      expect(retryBtn).toBeNull()
    })

    it('should have correct ARIA attributes', () => {
      statusBar = new StatusBar(container)

      statusBar.show('connecting')

      const status = container.querySelector('.chat-status')
      expect(status?.getAttribute('role')).toBe('status')
      expect(status?.getAttribute('aria-live')).toBe('polite')
    })
  })

  describe('hide', () => {
    it('should remove status bar from DOM', () => {
      statusBar = new StatusBar(container)
      statusBar.show('connecting')

      expect(container.querySelector('.chat-status')).toBeTruthy()

      statusBar.hide()

      expect(container.querySelector('.chat-status')).toBeNull()
    })

    it('should cleanup retry button listener on hide', () => {
      const onRetry = vi.fn()
      statusBar = new StatusBar(container, { onRetry })
      statusBar.show('error')

      const retryBtn = container.querySelector('.chat-status__retry') as HTMLButtonElement

      statusBar.hide()

      // Button removed, clicking should not trigger callback
      retryBtn?.click()
      expect(onRetry).not.toHaveBeenCalled()
    })
  })

  describe('deduplication', () => {
    it('should not recreate status bar for same status type', () => {
      statusBar = new StatusBar(container)

      statusBar.show('connecting', 'First message')
      const firstElement = container.querySelector('.chat-status')

      statusBar.show('connecting', 'Second message')
      const secondElement = container.querySelector('.chat-status')

      // Should be the same element (not recreated)
      expect(firstElement).toBe(secondElement)
      // Text should remain from first call (deduplication)
      expect(firstElement?.textContent).toContain('First message')
    })

    it('should recreate status bar for different status type', () => {
      statusBar = new StatusBar(container)

      statusBar.show('connecting', 'Connecting...')
      statusBar.show('error', 'Error!')

      const status = container.querySelector('.chat-status')
      expect(status?.classList.contains('chat-status--error')).toBe(true)
      expect(status?.textContent).toContain('Error!')
    })
  })

  describe('updateFromConnectionState', () => {
    it('should show connecting status for connecting state', () => {
      statusBar = new StatusBar(container)

      statusBar.updateFromConnectionState('connecting')

      const status = container.querySelector('.chat-status--connecting')
      expect(status).toBeTruthy()
    })

    it('should show reconnecting status for reconnecting state', () => {
      statusBar = new StatusBar(container)

      statusBar.updateFromConnectionState('reconnecting')

      const status = container.querySelector('.chat-status--reconnecting')
      expect(status).toBeTruthy()
    })

    it('should show disconnected status for disconnected state', () => {
      statusBar = new StatusBar(container)

      statusBar.updateFromConnectionState('disconnected')

      const status = container.querySelector('.chat-status--disconnected')
      expect(status).toBeTruthy()
    })

    it('should hide status bar on connected state', () => {
      statusBar = new StatusBar(container)
      statusBar.show('connecting')

      statusBar.updateFromConnectionState('connected')

      expect(container.querySelector('.chat-status')).toBeNull()
    })
  })

  describe('showError', () => {
    it('should show error with custom message', () => {
      statusBar = new StatusBar(container)

      statusBar.showError('Custom error message')

      const status = container.querySelector('.chat-status--error')
      expect(status?.textContent).toContain('Custom error message')
    })
  })

  describe('onRetry callback', () => {
    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn()
      statusBar = new StatusBar(container, { onRetry })

      statusBar.show('error')

      const retryBtn = container.querySelector('.chat-status__retry') as HTMLButtonElement
      retryBtn.click()

      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('should call onRetry multiple times on multiple clicks', () => {
      const onRetry = vi.fn()
      statusBar = new StatusBar(container, { onRetry })

      statusBar.show('error')

      const retryBtn = container.querySelector('.chat-status__retry') as HTMLButtonElement
      retryBtn.click()
      retryBtn.click()
      retryBtn.click()

      expect(onRetry).toHaveBeenCalledTimes(3)
    })
  })

  describe('default messages', () => {
    it('should use default message for connecting', () => {
      statusBar = new StatusBar(container)

      statusBar.show('connecting')

      const status = container.querySelector('.chat-status')
      expect(status?.textContent).toContain('Подключение...')
    })

    it('should use default message for error', () => {
      statusBar = new StatusBar(container)

      statusBar.show('error')

      const status = container.querySelector('.chat-status')
      expect(status?.textContent).toContain('Ошибка подключения')
    })
  })
})

/**
 * DellShop Chat Widget - Main orchestrator class
 */

import type { WidgetConfig } from './types/config'
import type { Message } from './types/messages'
import type { WidgetState } from './types/events'
import { DEFAULT_CONFIG, resolveVariant } from './types/config'
import { StateManager } from './core/state'
import { HttpClient, RateLimitError } from './transport/http'
import { WebSocketClient, ConnectionState } from './transport/websocket'
import { loadCSS, domReady, uniqueId } from './utils/dom'
import { loadSettings, saveSettings, saveSessionId } from './utils/storage'
import { showNotification, requestNotificationPermission } from './utils/notifications'
import {
  ChatButton,
  ChatContainer,
  ChatHeader,
  MessagesList,
  ChatInput,
  StatusBar,
  TelegramLink
} from './ui'
import { errorLogger } from './utils/error-logger'

/** Widget version - increment on each push to origin/main */
export const WIDGET_VERSION = '0.1.1'

export class ChatWidget {
  private config: Required<WidgetConfig>
  private state: StateManager
  private httpClient: HttpClient
  private wsClient: WebSocketClient
  private currentVariant: 'modal' | 'drawer'

  // UI Components
  private button: ChatButton | null = null
  private container: ChatContainer | null = null
  private header: ChatHeader | null = null
  private messages: MessagesList | null = null
  private input: ChatInput | null = null
  private statusBar: StatusBar | null = null
  private telegramLink: TelegramLink | null = null

  private initialized = false
  private _sessionId: string | null = null
  private resizeHandler: (() => void) | null = null
  private botInfo: { name: string; avatarUrl: string | null } | null = null

  // Rate limiting: max 20 messages per minute
  private readonly MAX_MESSAGES_PER_MINUTE = 20
  private readonly MAX_MESSAGE_LENGTH = 4000
  private messageTimes: number[] = []

  // Singleton AudioContext for notification sounds
  private static audioContext: AudioContext | null = null

  // Flag to prevent duplicate history loading requests
  private isLoadingHistory = false

  constructor(config: Partial<WidgetConfig> = {}) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    } as Required<WidgetConfig>

    // Determine variant
    this.currentVariant = resolveVariant(
      this.config.variant,
      this.config.responsive,
      window.innerWidth
    )

    // Initialize error logger
    errorLogger.init({ apiUrl: this.config.apiUrl })

    // Initialize managers
    this.state = new StateManager()
    this.httpClient = new HttpClient(this.config.apiUrl)
    this.wsClient = new WebSocketClient({
      url: this.config.wsUrl
    })

    // Setup WebSocket handlers
    this.setupWebSocketHandlers()

    // Setup state listeners
    this.setupStateListeners()

    // Setup resize handler for auto variant
    if (this.config.variant === 'auto') {
      this.setupResizeHandler()
    }
  }

  /**
   * Initialize widget
   */
  async init(): Promise<void> {
    if (this.initialized) return

    await domReady()

    try {
      // Load base CSS
      await loadCSS(`${this.config.baseUrl}/base.css`)

      // Create UI components
      this.createButton()
      this.createContainer()

      // Mount to DOM
      document.body.appendChild(this.button!.getElement())
      document.body.appendChild(this.container!.getWrapper())

      this.initialized = true
      this.state.emit('widget:ready', undefined)

      // Fetch bot info (non-blocking)
      this.fetchBotInfo()

      // Auto-open if configured
      if (this.config.autoOpen) {
        this.open()
      }
    } catch (error) {
      console.error('[ChatWidget] Initialization failed:', error)
      this.state.emit('widget:error', error as Error)
    }
  }

  /**
   * Open chat window
   */
  async open(): Promise<void> {
    console.log('[ChatWidget] open() called, initialized:', this.initialized)

    if (!this.initialized) {
      await this.init()
    }

    this.button?.hide()
    this.container?.open()
    this.input?.focus()

    // Reset unread count when chat is opened
    this.state.clearUnread()
    this.button?.setUnreadCount(0)

    // Connect if not connected
    const isConnected = this.wsClient.isConnected()
    console.log('[ChatWidget] isConnected:', isConnected)
    if (!isConnected) {
      await this.connect()
    }

    // Request notification permission (non-blocking)
    if (this.config.notifications) {
      requestNotificationPermission()
    }

    this.state.emit('widget:open', undefined)
  }

  /**
   * Close chat window
   */
  close(): void {
    this.container?.close()
    this.button?.show()
    this.state.emit('widget:close', undefined)
  }

  /**
   * Toggle chat window
   */
  toggle(): void {
    if (this.container?.isOpened()) {
      this.close()
    } else {
      this.open()
    }
  }

  /**
   * Send message
   */
  sendMessage(text: string): void {
    if (!text.trim()) return

    // Check message length
    if (text.length > this.MAX_MESSAGE_LENGTH) {
      this.statusBar?.show('error', `Сообщение слишком длинное (макс. ${this.MAX_MESSAGE_LENGTH} символов)`)
      return
    }

    // Rate limiting check
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Remove old timestamps
    this.messageTimes = this.messageTimes.filter(time => time > oneMinuteAgo)

    if (this.messageTimes.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.statusBar?.show('error', 'Слишком много сообщений. Подождите немного.')
      return
    }

    this.messageTimes.push(now)

    const tempId = uniqueId('msg')

    // Add to local state immediately
    const localMessage: Message = {
      id: tempId,
      text,
      from: 'user',
      timestamp: new Date().toISOString(),
      status: 'sending',
      temp_id: tempId
    }

    this.state.addMessage(localMessage)
    this.messages?.addMessage(localMessage)

    // Send via WebSocket
    this.wsClient.sendMessage(text)
  }

  /**
   * Send file
   */
  async sendFile(file: File): Promise<void> {
    // Rate limiting check
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    this.messageTimes = this.messageTimes.filter(time => time > oneMinuteAgo)

    if (this.messageTimes.length >= this.MAX_MESSAGES_PER_MINUTE) {
      this.statusBar?.show('error', 'Слишком много сообщений. Подождите немного.')
      throw new Error('Rate limited')
    }

    this.messageTimes.push(now)

    // Show uploading state
    this.input?.setUploading(true)

    try {
      await this.httpClient.uploadFile(
        file,
        (progress) => this.input?.showUploadProgress(progress)
      )
      // Show success indicator briefly
      this.input?.showUploadResult(true)
      await this.delay(500)
    } catch (error) {
      console.error('[ChatWidget] File upload failed:', error)
      // Show error indicator
      this.input?.showUploadResult(false)
      await this.delay(1000)
      if (error instanceof RateLimitError) {
        this.statusBar?.show('error', error.message)
      } else {
        this.statusBar?.show('error', 'Не удалось отправить файл')
      }
      throw error
    } finally {
      this.input?.setUploading(false)
    }
  }

  /**
   * Change widget variant
   */
  setVariant(variant: 'modal' | 'drawer'): void {
    if (variant === this.currentVariant) return

    const wasOpen = this.container?.isOpened() || false

    // Destroy current container
    this.destroyContainer()

    // Update variant
    this.currentVariant = variant
    saveSettings({ variant })

    // Recreate container with new variant
    this.createContainer()
    document.body.appendChild(this.container!.getWrapper())

    // Restore state
    if (wasOpen) {
      this.container?.open()
    }
  }

  /**
   * Get current variant
   */
  getVariant(): 'modal' | 'drawer' {
    return this.currentVariant
  }

  /**
   * Toggle between modal and drawer variants
   */
  toggleVariant(): void {
    const newVariant = this.currentVariant === 'modal' ? 'drawer' : 'modal'
    this.setVariant(newVariant)
  }

  /**
   * Get session ID
   */
  getSessionId(): string | null {
    return this._sessionId
  }

  /**
   * Enable/disable sound
   */
  setSoundEnabled(enabled: boolean): void {
    this.config.sound = enabled
    saveSettings({ soundEnabled: enabled })
  }

  /**
   * Destroy widget
   */
  destroy(): void {
    // Remove resize handler
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler)
      this.resizeHandler = null
    }

    this.wsClient.disconnect()
    errorLogger.destroy()

    this.button?.destroy()
    this.destroyContainer()

    this.initialized = false
  }

  /**
   * Subscribe to events
   */
  on<K extends keyof import('./types/events').WidgetEventMap>(
    event: K,
    handler: (data: import('./types/events').WidgetEventMap[K]) => void
  ): () => void {
    return this.state.on(event, handler)
  }

  // Private methods

  private async connect(): Promise<void> {
    this.state.setState('connecting')

    try {
      // Initialize session via HTTP
      const initResponse = await this.httpClient.init()

      // Save session ID to localStorage (fallback for blocked cookies)
      const sessionId = initResponse.data.sessionId
      saveSessionId(sessionId)
      this._sessionId = sessionId
      errorLogger.setSessionId(sessionId)

      // Load history if available
      if (initResponse.data.hasHistory) {
        const historyResponse = await this.httpClient.getHistory({ limit: 50 })
        if (historyResponse.data.messages.length > 0) {
          // Resolve relative media URLs to absolute
          const resolvedMessages = historyResponse.data.messages.map(m => this.resolveMediaUrls(m))
          this.state.setMessages(resolvedMessages)
          this.messages?.addMessages(resolvedMessages)
        }
      }

      // Pass session ID to WebSocket (for browsers with blocked cookies)
      this.wsClient.setSessionId(sessionId)

      // Connect WebSocket
      this.wsClient.connect()

      // Show telegram link (unlinked by default, will update on channel_linked event)
      this.telegramLink?.setUnlinked()
      this.telegramLink?.show()
    } catch (error) {
      console.error('[ChatWidget] Connection failed:', error)
      this.state.setState('error')
      if (error instanceof RateLimitError) {
        this.statusBar?.show('error', error.message)
      } else {
        this.statusBar?.showError('Не удалось подключиться')
      }
    }
  }

  private setupWebSocketHandlers(): void {
    this.wsClient.setHandlers({
      onConnected: (sessionId) => {
        this._sessionId = sessionId
        this.state.setState('connected')
        this.input?.enable()
      },

      onDisconnected: () => {
        this.state.setState('disconnected')
        this.input?.disable()
      },

      onMessage: (message) => {
        // Server echoes user messages back as confirmation
        if (message.from === 'user') {
          // Update status of pending messages to 'sent'
          this.confirmPendingMessages()
          return
        }

        // Resolve relative media URLs to absolute using apiUrl
        const resolvedMessage = this.resolveMediaUrls(message)

        this.state.addMessage(resolvedMessage)
        this.messages?.addMessage(resolvedMessage)

        // Play sound and show browser notification for support messages
        // only when user is not actively looking at the chat
        if (resolvedMessage.from === 'support') {
          const isTabHidden = document.hidden
          const isChatClosed = !this.container?.isOpened()

          if (isTabHidden || isChatClosed) {
            // Play sound if enabled
            if (this.config.sound) {
              this.playNotificationSound()
            }

            // Show browser notification if tab is hidden and notifications enabled
            if (isTabHidden && this.config.notifications) {
              showNotification('DellShop Поддержка', resolvedMessage.text, {
                onClick: () => this.open()
              })
            }
          }
        }

        // Update unread count if minimized
        if (!this.container?.isOpened()) {
          this.state.incrementUnread()
          this.button?.setUnreadCount(this.state.getState().unreadCount)
        }
      },

      onTyping: (isTyping) => {
        if (isTyping) {
          this.messages?.showTyping()
        } else {
          this.messages?.hideTyping()
        }
      },

      onStatus: (status) => {
        this.header?.setSubtitle(this.getStatusText(status))
      },

      onChannelLinked: (channel, username) => {
        if (channel === 'telegram') {
          this.telegramLink?.setLinked(username)
        }
      },

      onError: (error) => {
        console.error('[ChatWidget] WebSocket error:', error)
        this.state.emit('widget:error', error)
      },

      onStateChange: (state) => {
        this.handleConnectionStateChange(state)
      }
    })
  }

  private setupStateListeners(): void {
    // Handle state changes
    this.state.on('state:change', (newState) => {
      this.handleStateChange(newState)
    })
  }

  private setupResizeHandler(): void {
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null

    this.resizeHandler = () => {
      // Debounce resize events
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      resizeTimeout = setTimeout(() => {
        const newVariant = resolveVariant(
          this.config.variant,
          this.config.responsive,
          window.innerWidth
        )

        if (newVariant !== this.currentVariant && this.initialized) {
          this.setVariant(newVariant)
        }
      }, 150)
    }

    window.addEventListener('resize', this.resizeHandler, { passive: true })
  }

  private handleStateChange(newState: WidgetState): void {
    switch (newState) {
      case 'connecting':
        this.statusBar?.show('connecting', 'Подключение...')
        this.input?.disable()
        break
      case 'connected':
        this.statusBar?.hide()
        this.input?.enable()
        break
      case 'disconnected':
        this.statusBar?.show('disconnected', 'Соединение потеряно')
        this.input?.disable()
        break
      case 'error':
        this.statusBar?.show('error', 'Ошибка подключения')
        this.input?.disable()
        break
    }
  }

  private handleConnectionStateChange(state: ConnectionState): void {
    switch (state) {
      case 'connecting':
        this.state.setState('connecting')
        break
      case 'reconnecting':
        this.statusBar?.show('reconnecting', 'Переподключение...')
        break
      case 'connected':
        this.state.setState('connected')
        break
      case 'disconnected':
        this.state.setState('disconnected')
        break
    }
  }

  private createButton(): void {
    this.button = new ChatButton({
      position: this.config.position === 'left' ? 'bottom-left' : 'bottom-right',
      onClick: () => {
        this.open().catch(err => console.error('[ChatWidget] open() error:', err))
      }
    })
  }

  private createContainer(): void {
    // Create container
    this.container = new ChatContainer({
      variant: this.currentVariant,
      baseUrl: this.config.baseUrl,
      onClose: () => this.close()
    })

    const containerEl = this.container.getContainer()

    // Create header
    this.header = new ChatHeader({
      title: this.botInfo?.name ?? 'Поддержка DellShop',
      subtitle: 'Мы онлайн',
      avatarUrl: this.botInfo?.avatarUrl,
      onClose: () => this.close(),
      onMinimize: () => this.close(),
      onToggleVariant: () => this.toggleVariant(),
      showMinimize: true,
      showToggleVariant: true,
      variant: this.currentVariant
    })
    containerEl.appendChild(this.header.getElement())

    // Create messages list
    this.messages = new MessagesList({
      onScrollTop: () => this.loadMoreHistory()
    })
    containerEl.appendChild(this.messages.getElement())

    // Create status bar
    this.statusBar = new StatusBar(containerEl, {
      onRetry: () => this.connect()
    })

    // Create telegram link
    this.telegramLink = new TelegramLink({
      onLink: () => this.linkTelegram()
    })
    containerEl.appendChild(this.telegramLink.getElement())

    // Create input
    this.input = new ChatInput({
      placeholder: 'Введите сообщение...',
      maxLength: 4000,
      onSend: (text) => this.sendMessage(text),
      onTyping: (isTyping) => this.wsClient.sendTyping(isTyping),
      onFileSend: (file) => this.sendFile(file)
    })
    containerEl.appendChild(this.input.getElement())

    // Create version footer
    const versionFooter = document.createElement('div')
    versionFooter.className = 'chat-version'
    versionFooter.textContent = `v${WIDGET_VERSION}`
    containerEl.appendChild(versionFooter)

    // Load saved settings
    const settings = loadSettings()
    if (settings.variant && settings.variant !== this.currentVariant) {
      // Variant was changed before, use saved
      this.currentVariant = settings.variant
    }
  }

  private destroyContainer(): void {
    this.header?.destroy()
    this.messages?.destroy()
    this.input?.destroy()
    this.telegramLink?.destroy()
    this.container?.destroy()

    this.header = null
    this.messages = null
    this.input = null
    this.statusBar = null
    this.telegramLink = null
    this.container = null
  }

  private async loadMoreHistory(): Promise<void> {
    // Prevent duplicate requests
    if (this.isLoadingHistory) return

    const messages = this.state.getState().messages
    if (messages.length === 0) return

    const oldestMessage = messages[0]
    this.isLoadingHistory = true

    try {
      this.messages?.showLoading()
      const response = await this.httpClient.getHistory({
        before: oldestMessage.id,
        limit: 20
      })

      if (response.data.messages.length > 0) {
        // Resolve relative media URLs to absolute
        const resolvedMessages = response.data.messages.map(m => this.resolveMediaUrls(m))
        this.state.prependMessages(resolvedMessages)
        this.messages?.addMessages(resolvedMessages, true)
      }
    } catch (error) {
      console.error('[ChatWidget] Failed to load history:', error)
      if (error instanceof RateLimitError) {
        this.statusBar?.show('error', error.message)
      } else {
        this.statusBar?.show('error', 'Не удалось загрузить историю')
      }
    } finally {
      this.isLoadingHistory = false
      this.messages?.hideLoading()
    }
  }

  private async linkTelegram(): Promise<void> {
    this.telegramLink?.setLoading(true)

    try {
      const response = await this.httpClient.linkTelegram()

      // Open Telegram link in new tab
      window.open(response.data.telegramUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error('[ChatWidget] Failed to get Telegram link:', error)
      if (error instanceof RateLimitError) {
        this.statusBar?.show('error', error.message)
      } else {
        this.statusBar?.show('error', 'Не удалось получить ссылку Telegram')
      }
    } finally {
      this.telegramLink?.setLoading(false)
    }
  }

  private getStatusText(status: string): string {
    switch (status) {
      case 'online':
        return 'Мы онлайн'
      case 'offline':
        return 'Оператор offline'
      case 'typing':
        return 'Печатает...'
      default:
        return status
    }
  }

  private resolveMediaUrls(message: Message): Message {
    // If URLs are already absolute, return as-is
    if (!message.imageUrl?.startsWith('/') && !message.voiceUrl?.startsWith('/')) {
      return message
    }

    // Resolve relative URLs using apiUrl
    const baseUrl = this.config.apiUrl.replace(/\/$/, '') // Remove trailing slash

    return {
      ...message,
      ...(message.imageUrl?.startsWith('/') && { imageUrl: baseUrl + message.imageUrl }),
      ...(message.voiceUrl?.startsWith('/') && { voiceUrl: baseUrl + message.voiceUrl }),
    }
  }

  private playNotificationSound(): void {
    // Simple beep sound using Web Audio API with singleton AudioContext
    try {
      // Create AudioContext lazily (singleton pattern)
      if (!ChatWidget.audioContext) {
        ChatWidget.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = ChatWidget.audioContext

      // Resume context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.1

      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.warn('[ChatWidget] Notification sound failed:', error)
    }
  }

  private async fetchBotInfo(): Promise<void> {
    try {
      const response = await this.httpClient.getBotInfo()
      // Resolve relative avatar URL to absolute
      let avatarUrl = response.data.avatarUrl
      if (avatarUrl?.startsWith('/')) {
        const baseUrl = this.config.apiUrl.replace(/\/$/, '')
        avatarUrl = baseUrl + avatarUrl
      }
      this.botInfo = {
        name: response.data.name,
        avatarUrl
      }
      // Update header if already created
      if (this.header) {
        this.header.setTitle(this.botInfo.name)
        if (this.botInfo.avatarUrl) {
          this.header.setAvatar(this.botInfo.avatarUrl)
        }
      }
    } catch (error) {
      console.warn('[ChatWidget] Failed to fetch bot info:', error)
    }
  }

  private confirmPendingMessages(): void {
    // Find all messages with 'sending' status and update to 'sent'
    const messages = this.state.getState().messages
    for (const msg of messages) {
      if (msg.from === 'user' && msg.status === 'sending') {
        msg.status = 'sent'
        this.messages?.updateMessageStatus(msg.id, 'sent')
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

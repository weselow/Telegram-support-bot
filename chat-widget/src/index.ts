/**
 * DellShop Chat Widget
 *
 * Embeddable chat widget for customer support with WebSocket communication
 * and Telegram integration.
 *
 * Usage:
 *
 * 1. Via script tag with auto-init:
 * <script src="https://chat.dellshop.ru/widget.js"
 *         data-variant="modal"
 *         data-auto-open="false">
 * </script>
 *
 * 2. Programmatic initialization:
 * const widget = new DellShopChat.Widget({
 *   variant: 'modal',
 *   apiUrl: 'https://chat.dellshop.ru',
 *   wsUrl: 'wss://chat.dellshop.ru/ws/chat'
 * });
 * widget.init();
 */

import { ChatWidget } from './widget'
import type { WidgetConfig, WidgetVariant } from './types/config'
import type { Message } from './types/messages'
import type { WidgetEventMap, WidgetState } from './types/events'

// Export types
export type { WidgetConfig, WidgetVariant, Message, WidgetEventMap, WidgetState }

// Export Widget class
export { ChatWidget as Widget }

// Expose Widget class immediately for programmatic use
;(window as any).DellShopChat = {
  Widget: ChatWidget,
  instance: null as ChatWidget | null,

  // Convenience methods (will use instance when available)
  open: () => (window as any).DellShopChat.instance?.open(),
  close: () => (window as any).DellShopChat.instance?.close(),
  toggle: () => (window as any).DellShopChat.instance?.toggle(),
  sendMessage: (text: string) => (window as any).DellShopChat.instance?.sendMessage(text),
  setVariant: (variant: 'modal' | 'drawer') => (window as any).DellShopChat.instance?.setVariant(variant),
  destroy: () => (window as any).DellShopChat.instance?.destroy(),
  on: <K extends keyof WidgetEventMap>(
    event: K,
    handler: (data: WidgetEventMap[K]) => void
  ) => (window as any).DellShopChat.instance?.on(event, handler)
}

// Parse config from script tag data attributes and URL parameters
function parseScriptConfig(): Partial<WidgetConfig> {
  const windowConfig = (window as any).DellShopChatConfig as Partial<WidgetConfig> | undefined
  const config: Partial<WidgetConfig> = { ...windowConfig }

  const scripts = document.querySelectorAll('script[src*="widget"], script[src*="chat"]')
  const currentScript = scripts[scripts.length - 1] as HTMLScriptElement | null

  if (currentScript) {
    // Parse URL query parameters from script src
    // e.g., chat-widget.js?theme=chatgpt&variant=drawer
    try {
      const scriptUrl = new URL(currentScript.src)
      const urlParams = scriptUrl.searchParams

      const urlTheme = urlParams.get('theme')
      if (urlTheme === 'default' || urlTheme === 'chatgpt') {
        config.themePreset = urlTheme
      }

      const urlVariant = urlParams.get('variant')
      if (urlVariant === 'modal' || urlVariant === 'drawer' || urlVariant === 'auto') {
        config.variant = urlVariant
      }

      if (urlParams.get('autoOpen') === 'true') config.autoOpen = true
      if (urlParams.get('sound') === 'false') config.sound = false

      const urlPosition = urlParams.get('position')
      if (urlPosition === 'left' || urlPosition === 'right') {
        config.position = urlPosition
      }
    } catch {
      // Ignore URL parsing errors
    }

    // Data attributes override URL parameters
    const variant = currentScript.dataset.variant as WidgetVariant
    if (variant === 'modal' || variant === 'drawer' || variant === 'auto') {
      config.variant = variant
    }
    if (currentScript.dataset.autoOpen === 'true') config.autoOpen = true
    else if (currentScript.dataset.autoOpen === 'false') config.autoOpen = false
    if (currentScript.dataset.sound === 'false') config.sound = false
    else if (currentScript.dataset.sound === 'true') config.sound = true
    if (currentScript.dataset.position === 'left' || currentScript.dataset.position === 'right') {
      config.position = currentScript.dataset.position
    }
    if (currentScript.dataset.apiUrl) config.apiUrl = currentScript.dataset.apiUrl
    if (currentScript.dataset.wsUrl) config.wsUrl = currentScript.dataset.wsUrl
    if (currentScript.dataset.baseUrl) config.baseUrl = currentScript.dataset.baseUrl
    if (currentScript.dataset.theme === 'default' || currentScript.dataset.theme === 'chatgpt') {
      config.themePreset = currentScript.dataset.theme
    }
  }

  return config
}

// Auto-initialization with retry mechanism
function autoInit(): boolean {
  try {
    if ((window as any).DellShopChat.instance) {
      return true
    }

    const config = parseScriptConfig()
    const widget = new ChatWidget(config)
    ;(window as any).DellShopChat.instance = widget
    widget.init()
    return true
  } catch (error) {
    console.error('[ChatWidget] Auto-init failed:', error)
    return false
  }
}

// Robust initialization: try multiple times with different strategies
function initWithRetry(): void {
  // Strategy 1: Immediate
  if (autoInit()) return

  // Strategy 2: Next tick (microtask)
  Promise.resolve().then(() => {
    if (autoInit()) return

    // Strategy 3: Next frame
    requestAnimationFrame(() => {
      if (autoInit()) return

      // Strategy 4: Delayed retry (100ms)
      setTimeout(() => {
        if (autoInit()) return

        // Strategy 5: Final attempt (500ms)
        setTimeout(() => {
          autoInit()
        }, 400)
      }, 100)
    })
  })
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWithRetry)
} else {
  initWithRetry()
}

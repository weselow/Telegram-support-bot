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

// Auto-initialization from script tag and/or window config
function autoInit(): void {
  // Start with window.DellShopChatConfig if available
  const windowConfig = (window as any).DellShopChatConfig as Partial<WidgetConfig> | undefined
  const config: Partial<WidgetConfig> = { ...windowConfig }

  // Find the script tag for data attributes (override window config)
  const scripts = document.querySelectorAll('script[src*="widget"]')
  const currentScript = scripts[scripts.length - 1] as HTMLScriptElement | null

  if (currentScript) {
    // Variant
    const variant = currentScript.dataset.variant as WidgetVariant
    if (variant === 'modal' || variant === 'drawer' || variant === 'auto') {
      config.variant = variant
    }

    // Auto open
    if (currentScript.dataset.autoOpen === 'true') {
      config.autoOpen = true
    } else if (currentScript.dataset.autoOpen === 'false') {
      config.autoOpen = false
    }

    // Sound
    if (currentScript.dataset.sound === 'false') {
      config.sound = false
    } else if (currentScript.dataset.sound === 'true') {
      config.sound = true
    }

    // Position
    if (currentScript.dataset.position === 'left' || currentScript.dataset.position === 'right') {
      config.position = currentScript.dataset.position
    }

    // Custom URLs (data-attributes override window config)
    if (currentScript.dataset.apiUrl) {
      config.apiUrl = currentScript.dataset.apiUrl
    }

    if (currentScript.dataset.wsUrl) {
      config.wsUrl = currentScript.dataset.wsUrl
    }

    if (currentScript.dataset.baseUrl) {
      config.baseUrl = currentScript.dataset.baseUrl
    }
  }

  // Create and initialize widget
  const widget = new ChatWidget(config)
  widget.init()

  // Expose to window for external access
  ;(window as any).DellShopChat = {
    Widget: ChatWidget,
    instance: widget,

    // Convenience methods
    open: () => widget.open(),
    close: () => widget.close(),
    toggle: () => widget.toggle(),
    sendMessage: (text: string) => widget.sendMessage(text),
    setVariant: (variant: 'modal' | 'drawer') => widget.setVariant(variant),
    destroy: () => widget.destroy(),
    on: <K extends keyof WidgetEventMap>(
      event: K,
      handler: (data: WidgetEventMap[K]) => void
    ) => widget.on(event, handler)
  }
}

// Run auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInit)
} else {
  // DOM already loaded (script loaded async)
  autoInit()
}

// Also expose Widget class for programmatic use
;(window as any).DellShopChat = (window as any).DellShopChat || {
  Widget: ChatWidget
}

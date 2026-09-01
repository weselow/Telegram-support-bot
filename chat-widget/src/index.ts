/**
 * DellShop Chat Widget
 *
 * Embeddable chat widget for customer support with WebSocket communication
 * and Telegram integration.
 *
 * The widget is self-configuring: API, WebSocket and CSS are taken from the host
 * that served this script, so moving to another domain is a one-line change in
 * the embedding page. No domain is baked in at build time; when the script tag
 * cannot be found and no addresses are given, the widget refuses to start and
 * says so in the console.
 *
 * Usage:
 *
 * 1. Via script tag with auto-init:
 * <script src="https://chat.example.com/chat-widget/chat-widget.js"
 *         data-variant="modal"
 *         data-auto-open="false">
 * </script>
 *
 * 2. Programmatic initialization (addresses are mandatory here):
 * const widget = new DellShopChat.Widget({
 *   variant: 'modal',
 *   apiUrl: 'https://chat.example.com',
 *   wsUrl: 'wss://chat.example.com/ws/chat',
 *   baseUrl: 'https://chat.example.com/chat-widget'
 * });
 * widget.init();
 */

import { ChatWidget } from './widget'
import { findWidgetScript } from './utils/script-origin'
import { parseScriptConfig } from './utils/script-config'
import type { WidgetConfig, WidgetVariant } from './types/config'
import type { Message } from './types/messages'
import type { WidgetEventMap, WidgetState } from './types/events'

// Export types
export type { WidgetConfig, WidgetVariant, Message, WidgetEventMap, WidgetState }

// Export Widget class
export { ChatWidget as Widget }

// Capture our own script tag while document.currentScript is still meaningful.
// It is only set during synchronous evaluation of the script; by the time config
// is parsed (DOMContentLoaded or a later retry) it is always null.
const CURRENT_SCRIPT = document.currentScript as HTMLScriptElement | null

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

// Why the last attempt failed. Kept so the retries below stay silent and the
// reason is reported once, instead of five identical errors in a row.
let lastInitError: unknown = null

// Auto-initialization with retry mechanism
function autoInit(): boolean {
  try {
    if ((window as any).DellShopChat.instance) {
      return true
    }

    const windowConfig = (window as any).DellShopChatConfig as Partial<WidgetConfig> | undefined
    const config = parseScriptConfig(findWidgetScript(CURRENT_SCRIPT), windowConfig)
    const widget = new ChatWidget(config)
    ;(window as any).DellShopChat.instance = widget
    widget.init()
    return true
  } catch (error) {
    lastInitError = error
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
          if (autoInit()) return

          console.error('[ChatWidget] Auto-init failed:', lastInitError)
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

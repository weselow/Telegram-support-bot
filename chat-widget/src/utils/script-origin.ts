/**
 * Deriving server URLs from the address the widget script itself was loaded from.
 *
 * This keeps the widget self-configuring: whatever host serves chat-widget.js
 * also serves the API, the WebSocket and the CSS. Nothing is baked in at build
 * time, so this is the only automatic source of the server address.
 */

export interface ScriptOriginUrls {
  apiUrl: string
  wsUrl: string
  baseUrl: string
}

/** Same selector the widget has always used to locate its own script tag. */
const WIDGET_SCRIPT_SELECTOR = 'script[src*="widget"], script[src*="chat"]'

const WS_PATH = '/ws/chat'

/**
 * Derive API, WebSocket and static asset URLs from a script src.
 * Returns null when the src is missing or is not an http(s) address.
 */
export function deriveUrlsFromScriptSrc(src: string): ScriptOriginUrls | null {
  let url: URL

  try {
    url = new URL(src)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const directory = url.pathname.slice(0, url.pathname.lastIndexOf('/'))

  return {
    apiUrl: url.origin,
    wsUrl: `${wsProtocol}//${url.host}${WS_PATH}`,
    baseUrl: url.origin + directory
  }
}

/**
 * Locate the widget's own script tag.
 *
 * `captured` is document.currentScript grabbed at module evaluation time — the
 * only moment it is reliable. By the time config is parsed (DOMContentLoaded or
 * a later retry) it is always null, so the document search is the fallback.
 * That search is a guess: any script whose src contains "widget" or "chat" matches.
 */
export function findWidgetScript(captured: HTMLScriptElement | null): HTMLScriptElement | null {
  if (captured?.src) {
    return captured
  }

  const scripts = document.querySelectorAll<HTMLScriptElement>(WIDGET_SCRIPT_SELECTOR)

  return scripts[scripts.length - 1] ?? null
}

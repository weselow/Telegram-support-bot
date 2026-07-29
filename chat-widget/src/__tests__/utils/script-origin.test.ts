import { describe, it, expect, beforeEach } from 'vitest'
import { deriveUrlsFromScriptSrc, findWidgetScript } from '../../utils/script-origin'

describe('deriveUrlsFromScriptSrc', () => {
  describe('адреса из ссылки на скрипт', () => {
    it('should derive api, ws and base urls from a script in a subdirectory', () => {
      const result = deriveUrlsFromScriptSrc('https://chat.example.com/chat-widget/chat-widget.js')

      expect(result).toEqual({
        apiUrl: 'https://chat.example.com',
        wsUrl: 'wss://chat.example.com/ws/chat',
        baseUrl: 'https://chat.example.com/chat-widget'
      })
    })

    it('should ignore query parameters of the script url', () => {
      const result = deriveUrlsFromScriptSrc(
        'https://chat.example.com/chat-widget/chat-widget.js?theme=chatgpt&variant=drawer'
      )

      expect(result).toEqual({
        apiUrl: 'https://chat.example.com',
        wsUrl: 'wss://chat.example.com/ws/chat',
        baseUrl: 'https://chat.example.com/chat-widget'
      })
    })

    it('should use ws protocol for a script served over http', () => {
      const result = deriveUrlsFromScriptSrc('http://localhost:3500/chat-widget/chat-widget.js')

      expect(result).toEqual({
        apiUrl: 'http://localhost:3500',
        wsUrl: 'ws://localhost:3500/ws/chat',
        baseUrl: 'http://localhost:3500/chat-widget'
      })
    })

    it('should keep a non-default port in every url', () => {
      const result = deriveUrlsFromScriptSrc('https://example.com:8443/assets/chat-widget.js')

      expect(result).toEqual({
        apiUrl: 'https://example.com:8443',
        wsUrl: 'wss://example.com:8443/ws/chat',
        baseUrl: 'https://example.com:8443/assets'
      })
    })

    it('should handle a script placed at the site root', () => {
      const result = deriveUrlsFromScriptSrc('https://cdn.example.com/chat-widget.js')

      expect(result).toEqual({
        apiUrl: 'https://cdn.example.com',
        wsUrl: 'wss://cdn.example.com/ws/chat',
        baseUrl: 'https://cdn.example.com'
      })
    })

    it('should ignore a hash fragment of the script url', () => {
      const result = deriveUrlsFromScriptSrc('https://chat.example.com/w/chat-widget.js#anchor')

      expect(result?.baseUrl).toBe('https://chat.example.com/w')
    })
  })

  describe('нераспознаваемые адреса', () => {
    it('should return null for an empty string', () => {
      expect(deriveUrlsFromScriptSrc('')).toBeNull()
    })

    it('should return null for a malformed url', () => {
      expect(deriveUrlsFromScriptSrc('not a url')).toBeNull()
    })

    it('should return null for a non-http protocol', () => {
      expect(deriveUrlsFromScriptSrc('file:///opt/widget/chat-widget.js')).toBeNull()
    })
  })
})

describe('findWidgetScript', () => {
  beforeEach(() => {
    document.head.replaceChildren()
    document.body.replaceChildren()
  })

  it('should return the captured script when it has a src', () => {
    const captured = document.createElement('script')
    captured.src = 'https://chat.example.com/chat-widget/chat-widget.js'
    document.body.appendChild(captured)

    expect(findWidgetScript(captured)).toBe(captured)
  })

  it('should prefer the captured script over other widget scripts in the document', () => {
    const other = document.createElement('script')
    other.src = 'https://analytics.example.com/chat-tracker.js'
    document.body.appendChild(other)

    const captured = document.createElement('script')
    captured.src = 'https://chat.example.com/chat-widget/chat-widget.js'
    document.body.appendChild(captured)

    expect(findWidgetScript(captured)).toBe(captured)
  })

  it('should fall back to searching the document when nothing was captured', () => {
    const script = document.createElement('script')
    script.src = 'https://chat.example.com/chat-widget/chat-widget.js'
    document.body.appendChild(script)

    expect(findWidgetScript(null)).toBe(script)
  })

  it('should fall back when the captured script has no src', () => {
    const inline = document.createElement('script')
    document.body.appendChild(inline)

    const script = document.createElement('script')
    script.src = 'https://chat.example.com/chat-widget/chat-widget.js'
    document.body.appendChild(script)

    expect(findWidgetScript(inline)).toBe(script)
  })

  it('should return the last matching script in the fallback search', () => {
    const first = document.createElement('script')
    first.src = 'https://analytics.example.com/chat-tracker.js'
    document.body.appendChild(first)

    const last = document.createElement('script')
    last.src = 'https://chat.example.com/chat-widget/chat-widget.js'
    document.body.appendChild(last)

    expect(findWidgetScript(null)).toBe(last)
  })

  it('should return null when no widget script is present', () => {
    const unrelated = document.createElement('script')
    unrelated.src = 'https://example.com/app.js'
    document.body.appendChild(unrelated)

    expect(findWidgetScript(null)).toBeNull()
  })
})

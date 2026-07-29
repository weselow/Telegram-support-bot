import { describe, it, expect } from 'vitest'
import { parseScriptConfig } from '../../utils/script-config'

function scriptWith(src: string, dataset: Record<string, string> = {}): HTMLScriptElement {
  const script = document.createElement('script')
  script.src = src
  Object.entries(dataset).forEach(([key, value]) => {
    script.dataset[key] = value
  })
  return script
}

describe('parseScriptConfig', () => {
  describe('адреса из ссылки на скрипт', () => {
    it('should derive server urls from the script src', () => {
      const script = scriptWith('https://chat.example.com/chat-widget/chat-widget.js')

      const config = parseScriptConfig(script)

      expect(config.apiUrl).toBe('https://chat.example.com')
      expect(config.wsUrl).toBe('wss://chat.example.com/ws/chat')
      expect(config.baseUrl).toBe('https://chat.example.com/chat-widget')
    })

    it('should not derive urls when there is no script', () => {
      const config = parseScriptConfig(null)

      expect(config.apiUrl).toBeUndefined()
      expect(config.wsUrl).toBeUndefined()
      expect(config.baseUrl).toBeUndefined()
    })
  })

  describe('приоритет настроек', () => {
    it('should let data attributes override the derived urls', () => {
      const script = scriptWith('https://chat.example.com/chat-widget/chat-widget.js', {
        apiUrl: 'https://custom.example.com',
        wsUrl: 'wss://custom.example.com/ws/chat',
        baseUrl: 'https://custom.example.com/assets'
      })

      const config = parseScriptConfig(script)

      expect(config.apiUrl).toBe('https://custom.example.com')
      expect(config.wsUrl).toBe('wss://custom.example.com/ws/chat')
      expect(config.baseUrl).toBe('https://custom.example.com/assets')
    })

    it('should let window config override the derived urls', () => {
      const script = scriptWith('https://chat.example.com/chat-widget/chat-widget.js')

      const config = parseScriptConfig(script, { apiUrl: 'https://window.example.com' })

      expect(config.apiUrl).toBe('https://window.example.com')
      expect(config.wsUrl).toBe('wss://chat.example.com/ws/chat')
    })

    it('should let url parameters override the window config', () => {
      const script = scriptWith('https://chat.example.com/chat-widget/chat-widget.js?variant=drawer')

      const config = parseScriptConfig(script, { variant: 'modal' })

      expect(config.variant).toBe('drawer')
    })

    it('should let data attributes override url parameters', () => {
      const script = scriptWith(
        'https://chat.example.com/chat-widget/chat-widget.js?variant=drawer&theme=chatgpt',
        { variant: 'modal', theme: 'default' }
      )

      const config = parseScriptConfig(script)

      expect(config.variant).toBe('modal')
      expect(config.themePreset).toBe('default')
    })

    it('should keep window config values when there is no script', () => {
      const config = parseScriptConfig(null, { variant: 'drawer', autoOpen: true })

      expect(config.variant).toBe('drawer')
      expect(config.autoOpen).toBe(true)
    })
  })

  describe('параметры ссылки', () => {
    it('should read theme, variant, autoOpen, sound and position', () => {
      const script = scriptWith(
        'https://chat.example.com/w/chat-widget.js?theme=chatgpt&variant=drawer&autoOpen=true&sound=false&position=left'
      )

      const config = parseScriptConfig(script)

      expect(config.themePreset).toBe('chatgpt')
      expect(config.variant).toBe('drawer')
      expect(config.autoOpen).toBe(true)
      expect(config.sound).toBe(false)
      expect(config.position).toBe('left')
    })

    it('should ignore unknown values', () => {
      const script = scriptWith(
        'https://chat.example.com/w/chat-widget.js?theme=neon&variant=fullscreen&position=middle'
      )

      const config = parseScriptConfig(script)

      expect(config.themePreset).toBeUndefined()
      expect(config.variant).toBeUndefined()
      expect(config.position).toBeUndefined()
    })
  })

  describe('data-атрибуты', () => {
    it('should read every supported attribute', () => {
      const script = scriptWith('https://chat.example.com/w/chat-widget.js', {
        variant: 'drawer',
        autoOpen: 'true',
        sound: 'false',
        position: 'left',
        theme: 'chatgpt'
      })

      const config = parseScriptConfig(script)

      expect(config.variant).toBe('drawer')
      expect(config.autoOpen).toBe(true)
      expect(config.sound).toBe(false)
      expect(config.position).toBe('left')
      expect(config.themePreset).toBe('chatgpt')
    })

    it('should allow turning autoOpen and sound off explicitly', () => {
      const script = scriptWith('https://chat.example.com/w/chat-widget.js?autoOpen=true', {
        autoOpen: 'false',
        sound: 'true'
      })

      const config = parseScriptConfig(script)

      expect(config.autoOpen).toBe(false)
      expect(config.sound).toBe(true)
    })
  })
})

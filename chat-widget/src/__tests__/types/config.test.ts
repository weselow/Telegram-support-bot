import { describe, it, expect } from 'vitest'
import { DEFAULT_CONFIG, MISSING_SERVER_URLS_MESSAGE, resolveConfig } from '../../types/config'

const SERVER_URLS = {
  apiUrl: 'https://chat.example.com',
  wsUrl: 'wss://chat.example.com/ws/chat',
  baseUrl: 'https://chat.example.com/chat-widget'
}

describe('config', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should not carry any server address', () => {
      expect(DEFAULT_CONFIG).not.toHaveProperty('apiUrl')
      expect(DEFAULT_CONFIG).not.toHaveProperty('wsUrl')
      expect(DEFAULT_CONFIG).not.toHaveProperty('baseUrl')
    })

    it('should not mention a host anywhere in its values', () => {
      expect(JSON.stringify(DEFAULT_CONFIG)).not.toMatch(/https?:|wss?:/)
    })
  })

  describe('resolveConfig', () => {
    it('should keep the server urls given by the caller', () => {
      const config = resolveConfig(SERVER_URLS)

      expect(config.apiUrl).toBe('https://chat.example.com')
      expect(config.wsUrl).toBe('wss://chat.example.com/ws/chat')
      expect(config.baseUrl).toBe('https://chat.example.com/chat-widget')
    })

    it('should take the remaining settings from the defaults', () => {
      const config = resolveConfig(SERVER_URLS)

      expect(config.variant).toBe(DEFAULT_CONFIG.variant)
      expect(config.position).toBe(DEFAULT_CONFIG.position)
      expect(config.themePreset).toBe(DEFAULT_CONFIG.themePreset)
      expect(config.sound).toBe(DEFAULT_CONFIG.sound)
    })

    it('should let the caller override a plain setting', () => {
      const config = resolveConfig({ ...SERVER_URLS, variant: 'drawer' })

      expect(config.variant).toBe('drawer')
    })

    it('should merge responsive settings with the defaults', () => {
      const config = resolveConfig({ ...SERVER_URLS, responsive: { breakpoint: 500 } })

      expect(config.responsive.breakpoint).toBe(500)
      expect(config.responsive.mobile).toBe(DEFAULT_CONFIG.responsive.mobile)
      expect(config.responsive.desktop).toBe(DEFAULT_CONFIG.responsive.desktop)
    })

    it('should merge theme settings with the defaults', () => {
      const config = resolveConfig({ ...SERVER_URLS, theme: { borderRadius: '4px' } })

      expect(config.theme.borderRadius).toBe('4px')
      expect(config.theme.brandColor).toBe(DEFAULT_CONFIG.theme.brandColor)
    })

    it('should throw when apiUrl is missing', () => {
      expect(() => resolveConfig({ wsUrl: SERVER_URLS.wsUrl, baseUrl: SERVER_URLS.baseUrl })).toThrow(
        MISSING_SERVER_URLS_MESSAGE
      )
    })

    it('should throw when wsUrl is missing', () => {
      expect(() => resolveConfig({ apiUrl: SERVER_URLS.apiUrl, baseUrl: SERVER_URLS.baseUrl })).toThrow(
        MISSING_SERVER_URLS_MESSAGE
      )
    })

    it('should throw when baseUrl is missing', () => {
      expect(() => resolveConfig({ apiUrl: SERVER_URLS.apiUrl, wsUrl: SERVER_URLS.wsUrl })).toThrow(
        MISSING_SERVER_URLS_MESSAGE
      )
    })

    it('should throw when nothing is given at all', () => {
      expect(() => resolveConfig({})).toThrow(MISSING_SERVER_URLS_MESSAGE)
    })

    it('should name every missing url in the message', () => {
      expect(() => resolveConfig({})).toThrow(/apiUrl/)
      expect(() => resolveConfig({})).toThrow(/wsUrl/)
      expect(() => resolveConfig({})).toThrow(/baseUrl/)
    })
  })
})

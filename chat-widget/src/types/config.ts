/**
 * Widget configuration types
 */

export type WidgetVariant = 'modal' | 'drawer' | 'auto'
export type WidgetPosition = 'bottom-right' | 'bottom-left'

export interface ResponsiveConfig {
  breakpoint: number
  mobile: 'modal' | 'drawer'
  desktop: 'modal' | 'drawer'
}

export interface ThemeConfig {
  brandColor?: string
  borderRadius?: string
  fontFamily?: string
}

export interface WidgetConfig {
  /** API base URL */
  apiUrl: string

  /** WebSocket URL */
  wsUrl: string

  /** Base URL for static assets (CSS) */
  baseUrl: string

  /** Design variant: modal, drawer, or auto */
  variant: WidgetVariant

  /** Button position on screen */
  position: 'right' | 'left'

  /** Responsive settings for auto variant */
  responsive: ResponsiveConfig

  /** Theme customization */
  theme: ThemeConfig

  /** Enable debug logging */
  debug: boolean

  /** Auto-open chat on page load */
  autoOpen: boolean

  /** Enable notification sounds */
  sound: boolean

  /** Enable browser notifications */
  notifications: boolean
}

export type PartialWidgetConfig = Partial<WidgetConfig>

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: WidgetConfig = {
  apiUrl: 'https://chat.dellshop.ru',
  wsUrl: 'wss://chat.dellshop.ru/ws/chat',
  baseUrl: 'https://chat.dellshop.ru',
  variant: 'auto',
  position: 'right',
  responsive: {
    breakpoint: 768,
    mobile: 'drawer',
    desktop: 'modal'
  },
  theme: {
    brandColor: '#1e3a8a'
  },
  debug: false,
  autoOpen: false,
  sound: true,
  notifications: true
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: PartialWidgetConfig): WidgetConfig {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    responsive: {
      ...DEFAULT_CONFIG.responsive,
      ...userConfig.responsive
    },
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...userConfig.theme
    }
  }
}

/**
 * Resolve variant based on config and screen width
 */
export function resolveVariant(
  variant: WidgetVariant,
  responsive: ResponsiveConfig,
  screenWidth: number
): 'modal' | 'drawer' {
  if (variant === 'modal' || variant === 'drawer') {
    return variant
  }

  // Auto mode: use responsive settings
  return screenWidth < responsive.breakpoint ? responsive.mobile : responsive.desktop
}

/**
 * Widget configuration types
 */

export type WidgetVariant = 'modal' | 'drawer' | 'auto'
export type WidgetPosition = 'bottom-right' | 'bottom-left'
export type ThemePreset = 'default' | 'chatgpt'

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

  /** Theme preset: 'default' or 'chatgpt' */
  themePreset: ThemePreset

  /** Theme customization (colors, etc.) */
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

/** Anything a caller may pass in: nested groups can be filled in piece by piece. */
export type PartialWidgetConfig = Partial<Omit<WidgetConfig, 'responsive' | 'theme'>> & {
  responsive?: Partial<ResponsiveConfig>
  theme?: ThemeConfig
}

/**
 * Default configuration.
 *
 * Server addresses are deliberately absent: the widget has no idea which host
 * serves it until it looks at its own script tag, so there is nothing sensible
 * to bake in here. See resolveConfig below.
 */
export const DEFAULT_CONFIG: Omit<WidgetConfig, 'apiUrl' | 'wsUrl' | 'baseUrl'> = {
  variant: 'auto',
  position: 'right',
  responsive: {
    breakpoint: 768,
    mobile: 'drawer',
    desktop: 'modal'
  },
  themePreset: 'default',
  theme: {
    brandColor: '#1e3a8a'
  },
  debug: false,
  autoOpen: false,
  sound: true,
  notifications: true
}

/** Shown when the widget cannot tell which host to talk to. */
export const MISSING_SERVER_URLS_MESSAGE =
  '[ChatWidget] Cannot determine the support server address. ' +
  'The widget script tag was not found on the page and no apiUrl, wsUrl and baseUrl were given. ' +
  'Either keep the widget script tag as its own <script src="..."> (cache plugins that merge ' +
  'scripts into one file break the lookup), or set window.DellShopChatConfig = ' +
  '{ apiUrl, wsUrl, baseUrl } before loading the widget.'

/**
 * Build the full config out of whatever the caller managed to collect.
 * Throws when the server addresses are missing — a widget pointed at nothing
 * is worse than a widget that says out loud what is wrong.
 */
export function resolveConfig(userConfig: PartialWidgetConfig): WidgetConfig {
  const { apiUrl, wsUrl, baseUrl } = userConfig

  if (!apiUrl || !wsUrl || !baseUrl) {
    throw new Error(MISSING_SERVER_URLS_MESSAGE)
  }

  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    apiUrl,
    wsUrl,
    baseUrl,
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

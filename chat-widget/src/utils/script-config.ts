/**
 * Building widget config from the script tag that loaded the widget.
 *
 * Precedence, lowest first:
 *   urls derived from the script src -> window.DellShopChatConfig -> url parameters -> data attributes
 */

import { deriveUrlsFromScriptSrc } from './script-origin'
import type { PartialWidgetConfig, WidgetVariant } from '../types/config'

/** Settings that can be passed as query parameters of the script src. */
function parseUrlParams(src: string): PartialWidgetConfig {
  const config: PartialWidgetConfig = {}

  let params: URLSearchParams
  try {
    params = new URL(src).searchParams
  } catch {
    return config
  }

  const theme = params.get('theme')
  if (theme === 'default' || theme === 'chatgpt') config.themePreset = theme

  const variant = params.get('variant')
  if (variant === 'modal' || variant === 'drawer' || variant === 'auto') config.variant = variant

  if (params.get('autoOpen') === 'true') config.autoOpen = true
  if (params.get('sound') === 'false') config.sound = false

  const position = params.get('position')
  if (position === 'left' || position === 'right') config.position = position

  return config
}

/** Settings that can be passed as data-* attributes of the script tag. */
function parseDataAttributes(script: HTMLScriptElement): PartialWidgetConfig {
  const config: PartialWidgetConfig = {}
  const data = script.dataset

  const variant = data.variant as WidgetVariant
  if (variant === 'modal' || variant === 'drawer' || variant === 'auto') config.variant = variant

  if (data.autoOpen === 'true') config.autoOpen = true
  else if (data.autoOpen === 'false') config.autoOpen = false

  if (data.sound === 'false') config.sound = false
  else if (data.sound === 'true') config.sound = true

  if (data.position === 'left' || data.position === 'right') config.position = data.position
  if (data.apiUrl) config.apiUrl = data.apiUrl
  if (data.wsUrl) config.wsUrl = data.wsUrl
  if (data.baseUrl) config.baseUrl = data.baseUrl
  if (data.theme === 'default' || data.theme === 'chatgpt') config.themePreset = data.theme

  return config
}

/**
 * Collect config from the widget's script tag.
 * Without a script tag only the window config is returned, so the widget falls
 * back to the domain baked in at build time.
 */
export function parseScriptConfig(
  script: HTMLScriptElement | null,
  windowConfig?: PartialWidgetConfig
): PartialWidgetConfig {
  if (!script) {
    return { ...windowConfig }
  }

  return {
    ...deriveUrlsFromScriptSrc(script.src),
    ...windowConfig,
    ...parseUrlParams(script.src),
    ...parseDataAttributes(script)
  }
}

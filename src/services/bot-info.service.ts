/**
 * Service for getting bot information (name, avatar)
 * Caches bot info and avatar binary to avoid repeated API calls
 */

import { bot } from '../bot/bot.js'
import { logger } from '../utils/logger.js'

export interface BotInfo {
  name: string
  username: string
  avatarUrl: string
}

export interface BotAvatar {
  data: Buffer
  contentType: string
}

// In-memory cache for bot info (rarely changes)
let cachedBotInfo: BotInfo | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// In-memory cache for avatar binary
let cachedAvatar: BotAvatar | null = null
let avatarCacheTimestamp = 0

// SVG placeholder for bot without avatar (neutral person silhouette)
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <circle cx="20" cy="20" r="20" fill="#9CA3AF"/>
  <circle cx="20" cy="15" r="7" fill="#E5E7EB"/>
  <ellipse cx="20" cy="35" rx="12" ry="10" fill="#E5E7EB"/>
</svg>`

const PLACEHOLDER_AVATAR: BotAvatar = {
  data: Buffer.from(PLACEHOLDER_SVG),
  contentType: 'image/svg+xml',
}

/**
 * Get bot information with caching
 * Avatar URL always points to our proxy endpoint
 */
export async function getBotInfo(): Promise<BotInfo> {
  const now = Date.now()

  // Return cached info if still valid
  if (cachedBotInfo && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedBotInfo
  }

  try {
    const me = await bot.api.getMe()

    cachedBotInfo = {
      name: me.first_name + (me.last_name ? ` ${me.last_name}` : ''),
      username: me.username,
      avatarUrl: '/api/chat/bot-avatar',
    }
    cacheTimestamp = now

    logger.debug({ botInfo: cachedBotInfo }, 'Bot info cached')
    return cachedBotInfo
  } catch (error) {
    logger.error({ error }, 'Failed to get bot info')

    // Return fallback if cache exists but expired
    if (cachedBotInfo) {
      return cachedBotInfo
    }

    // Return default fallback
    return {
      name: 'Поддержка',
      username: '',
      avatarUrl: '/api/chat/bot-avatar',
    }
  }
}

/**
 * Get bot avatar binary with caching
 * Returns placeholder SVG if bot has no avatar or on error
 */
export async function getBotAvatar(): Promise<BotAvatar> {
  const now = Date.now()

  // Return cached avatar if still valid
  if (cachedAvatar && now - avatarCacheTimestamp < CACHE_TTL_MS) {
    return cachedAvatar
  }

  try {
    const me = await bot.api.getMe()
    const photos = await bot.api.getUserProfilePhotos(me.id, { limit: 1 })

    if (photos.total_count === 0 || !photos.photos[0]?.[0]) {
      logger.debug('Bot has no avatar, using placeholder')
      return PLACEHOLDER_AVATAR
    }

    const fileId = photos.photos[0][0].file_id
    const file = await bot.api.getFile(fileId)

    if (!file.file_path) {
      logger.warn('Bot avatar file has no path, using placeholder')
      return PLACEHOLDER_AVATAR
    }

    // Download avatar from Telegram
    const avatarUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`
    const response = await fetch(avatarUrl)

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Failed to download bot avatar')
      return PLACEHOLDER_AVATAR
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()

    cachedAvatar = {
      data: Buffer.from(arrayBuffer),
      contentType,
    }
    avatarCacheTimestamp = now

    logger.debug({ size: cachedAvatar.data.length }, 'Bot avatar cached')
    return cachedAvatar
  } catch (error) {
    logger.warn({ error }, 'Failed to get bot avatar, using placeholder')
    return PLACEHOLDER_AVATAR
  }
}

/**
 * Clear cached bot info and avatar (for testing)
 */
export function clearBotInfoCache(): void {
  cachedBotInfo = null
  cacheTimestamp = 0
  cachedAvatar = null
  avatarCacheTimestamp = 0
}

/**
 * Service for getting bot information (name, avatar)
 * Caches bot info to avoid repeated API calls
 */

import { bot } from '../bot/bot.js'
import { logger } from '../utils/logger.js'

export interface BotInfo {
  name: string
  username: string
  avatarUrl: string | null
}

// In-memory cache for bot info (rarely changes)
let cachedBotInfo: BotInfo | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Get bot information with caching
 */
export async function getBotInfo(): Promise<BotInfo> {
  const now = Date.now()

  // Return cached info if still valid
  if (cachedBotInfo && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedBotInfo
  }

  try {
    const me = await bot.api.getMe()

    // Try to get bot avatar
    let avatarUrl: string | null = null
    try {
      const photos = await bot.api.getUserProfilePhotos(me.id, { limit: 1 })
      if (photos.total_count > 0 && photos.photos[0]?.[0]) {
        const fileId = photos.photos[0][0].file_id
        const file = await bot.api.getFile(fileId)
        if (file.file_path) {
          avatarUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`
        }
      }
    } catch (avatarError) {
      logger.warn({ error: avatarError }, 'Failed to get bot avatar')
    }

    cachedBotInfo = {
      name: me.first_name + (me.last_name ? ` ${me.last_name}` : ''),
      username: me.username,
      avatarUrl,
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
      avatarUrl: null,
    }
  }
}

/**
 * Clear cached bot info (for testing)
 */
export function clearBotInfoCache(): void {
  cachedBotInfo = null
  cacheTimestamp = 0
}

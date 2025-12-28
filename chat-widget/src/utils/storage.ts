/**
 * Local storage utilities for draft messages
 */

const STORAGE_PREFIX = 'dellshop_chat_'
const DRAFT_KEY = `${STORAGE_PREFIX}draft`
const SETTINGS_KEY = `${STORAGE_PREFIX}settings`

interface StoredSettings {
  soundEnabled: boolean
  variant?: 'modal' | 'drawer'
}

/**
 * Safe localStorage access
 */
function getStorage(): Storage | null {
  try {
    const storage = window.localStorage
    // Test if localStorage is available
    const testKey = '__test__'
    storage.setItem(testKey, testKey)
    storage.removeItem(testKey)
    return storage
  } catch {
    return null
  }
}

/**
 * Save draft message
 */
export function saveDraft(text: string): void {
  const storage = getStorage()
  if (!storage) return

  if (text.trim()) {
    storage.setItem(DRAFT_KEY, text)
  } else {
    storage.removeItem(DRAFT_KEY)
  }
}

/**
 * Load draft message
 */
export function loadDraft(): string {
  const storage = getStorage()
  if (!storage) return ''

  return storage.getItem(DRAFT_KEY) || ''
}

/**
 * Clear draft message
 */
export function clearDraft(): void {
  const storage = getStorage()
  if (storage) {
    storage.removeItem(DRAFT_KEY)
  }
}

/**
 * Save user settings
 */
export function saveSettings(settings: Partial<StoredSettings>): void {
  const storage = getStorage()
  if (!storage) return

  const current = loadSettings()
  const updated = { ...current, ...settings }
  storage.setItem(SETTINGS_KEY, JSON.stringify(updated))
}

/**
 * Load user settings
 */
export function loadSettings(): StoredSettings {
  const storage = getStorage()
  const defaults: StoredSettings = {
    soundEnabled: true
  }

  if (!storage) return defaults

  try {
    const stored = storage.getItem(SETTINGS_KEY)
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) }
    }
  } catch {
    // Invalid JSON, return defaults
  }

  return defaults
}

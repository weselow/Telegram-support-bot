import { getRedisClient } from '../config/redis-client.js';
import { logger } from '../utils/logger.js';

export type OnboardingStep = 'awaiting_question' | 'awaiting_phone' | 'confirming_phone';

export interface OnboardingState {
  step: OnboardingStep;
  sourceUrl?: string;
  sourceCity?: string;
  ip?: string;
}

const ONBOARDING_PREFIX = 'onboarding:';
const ONBOARDING_TTL_SECONDS = 3600; // 1 hour

function getKey(tgUserId: bigint): string {
  return `${ONBOARDING_PREFIX}${String(tgUserId)}`;
}

export async function getOnboardingState(tgUserId: bigint): Promise<OnboardingState | null> {
  const redis = getRedisClient();
  const key = getKey(tgUserId);

  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as OnboardingState;
  } catch (error) {
    logger.error({ error, tgUserId: String(tgUserId) }, 'Failed to get onboarding state');
    return null;
  }
}

export async function setOnboardingState(tgUserId: bigint, state: OnboardingState): Promise<void> {
  const redis = getRedisClient();
  const key = getKey(tgUserId);

  try {
    await redis.setex(key, ONBOARDING_TTL_SECONDS, JSON.stringify(state));
    logger.debug({ tgUserId: String(tgUserId), step: state.step }, 'Onboarding state set');
  } catch (error) {
    logger.error({ error, tgUserId: String(tgUserId) }, 'Failed to set onboarding state');
    throw error;
  }
}

export async function clearOnboardingState(tgUserId: bigint): Promise<void> {
  const redis = getRedisClient();
  const key = getKey(tgUserId);

  try {
    await redis.del(key);
    logger.debug({ tgUserId: String(tgUserId) }, 'Onboarding state cleared');
  } catch (error) {
    logger.error({ error, tgUserId: String(tgUserId) }, 'Failed to clear onboarding state');
  }
}

export async function updateOnboardingStep(tgUserId: bigint, step: OnboardingStep): Promise<void> {
  const state = await getOnboardingState(tgUserId);
  if (state) {
    state.step = step;
    await setOnboardingState(tgUserId, state);
  }
}

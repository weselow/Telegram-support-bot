import { InlineKeyboard, Keyboard } from 'grammy';
import type { Context } from 'grammy';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types';
import { findUserByTgId, createTicket } from '../../services/ticket.service.js';
import { createTopic, sendTicketCard } from '../../services/topic.service.js';
import { startSlaTimers } from '../../services/sla.service.js';
import {
  getOnboardingState,
  setOnboardingState,
  clearOnboardingState,
  type OnboardingState,
} from '../../services/onboarding.service.js';
import { userRepository } from '../../db/repositories/user.repository.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { messages, formatMessage } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';
import { captureError } from '../../config/sentry.js';

export function buildPhoneRequestKeyboard(hasPhone: boolean): InlineKeyboardMarkup | ReplyKeyboardMarkup {
  if (hasPhone) {
    // User already has phone - ask to confirm or change
    return new InlineKeyboard()
      .text(messages.buttons.onboardingPhoneYes, 'onboard_phone_yes')
      .text(messages.buttons.onboardingPhoneChange, 'onboard_phone_change');
  }
  // New user - offer to send contact or skip
  return new InlineKeyboard()
    .text(messages.buttons.onboardingSkipPhone, 'onboard_phone_skip');
}

export function buildContactKeyboard(): ReplyKeyboardMarkup {
  return new Keyboard()
    .requestContact(messages.buttons.onboardingSendPhone)
    .row()
    .text(messages.buttons.onboardingSkipPhone)
    .oneTime()
    .resized();
}

export function buildChangePhoneKeyboard(): InlineKeyboardMarkup | ReplyKeyboardMarkup {
  return new InlineKeyboard()
    .text(messages.buttons.onboardingKeepOld, 'onboard_phone_keep');
}

/**
 * Handle onboarding flow for private messages.
 * Returns true if message was handled by onboarding, false otherwise.
 */
export async function handleOnboarding(ctx: Context): Promise<boolean> {
  if (!ctx.from || !ctx.message) {
    return false;
  }

  const tgUserId = BigInt(ctx.from.id);
  const state = await getOnboardingState(tgUserId);

  if (!state) {
    return false;
  }

  if (state.step === 'awaiting_question') {
    await handleAwaitingQuestion(ctx, tgUserId, state);
    return true;
  }

  if (state.step === 'awaiting_phone') {
    // Check if user clicked skip button (text message)
    if (ctx.message.text === messages.buttons.onboardingSkipPhone) {
      await handlePhoneSkip(ctx, tgUserId);
      return true;
    }
    // Other text messages during phone step - ignore (waiting for contact)
    return false;
  }

  // state.step === 'confirming_phone' - text messages ignored (use buttons)
  return false;
}

async function handlePhoneSkip(ctx: Context, tgUserId: bigint): Promise<void> {
  await ctx.reply(messages.onboarding.phoneSkipped, {
    reply_markup: { remove_keyboard: true },
  });
  await clearOnboardingState(tgUserId);
  logger.info({ tgUserId: String(tgUserId) }, 'Phone skipped during onboarding');
}

async function handleAwaitingQuestion(
  ctx: Context,
  tgUserId: bigint,
  state: OnboardingState,
): Promise<void> {
  // ctx.from and ctx.message are guaranteed by handleOnboarding check
  const from = ctx.from;
  const message = ctx.message;
  if (!from || !message) {
    return;
  }

  const firstName = from.first_name;
  const username = from.username ?? null;

  // Check if user already exists
  const user = await findUserByTgId(tgUserId);
  const isNewUser = !user;

  try {
    let currentUser = user;

    if (isNewUser) {
      // Create topic and ticket for new user
      logger.info({ tgUserId: from.id }, 'New user from onboarding, creating topic');

      const topic = await createTopic(ctx.api, {
        tgUserId: from.id,
        firstName,
        username: username ?? undefined,
      });

      currentUser = await createTicket({
        tgUserId,
        tgUsername: username,
        tgFirstName: firstName,
        topicId: topic.message_thread_id,
        question: message.text,
        sourceUrl: state.sourceUrl,
        sourceCity: state.sourceCity,
      });

      const cardMessageId = await sendTicketCard(
        ctx.api,
        topic.message_thread_id,
        currentUser.id,
        {
          tgUserId: from.id,
          firstName,
          username: username ?? undefined,
        },
        {
          sourceUrl: state.sourceUrl,
          sourceCity: state.sourceCity,
          sourceIp: state.ip,
        },
      );

      await userRepository.updateCardMessageId(currentUser.id, cardMessageId);
      await startSlaTimers(currentUser.id, topic.message_thread_id);
    } else if (currentUser) {
      // Existing user - update source info if provided
      if (state.sourceUrl) {
        await userRepository.updateSourceUrl(currentUser.id, state.sourceUrl);
      }

      // Log reopening event if needed
      if (currentUser.status === 'CLOSED') {
        await eventRepository.create({
          userId: currentUser.id,
          eventType: 'REOPENED',
          question: message.text,
          sourceUrl: state.sourceUrl,
        });
      }
    }

    if (!currentUser) {
      throw new Error('User not created during onboarding');
    }

    // Send confirmation
    await ctx.reply(messages.onboarding.ticketCreated);

    // Ask for phone
    const hasPhone = !!currentUser.phone;

    if (hasPhone && currentUser.phone) {
      // Ask to confirm existing phone
      await setOnboardingState(tgUserId, { ...state, step: 'confirming_phone' });
      await ctx.reply(formatMessage(messages.onboarding.askPhoneExisting, { phone: currentUser.phone }), {
        reply_markup: buildPhoneRequestKeyboard(true),
      });
    } else {
      // Ask for new phone with contact button + skip option
      await setOnboardingState(tgUserId, { ...state, step: 'awaiting_phone' });
      await ctx.reply(messages.onboarding.askPhoneNew, {
        reply_markup: buildContactKeyboard(),
      });
    }
  } catch (error) {
    captureError(error, { tgUserId: String(from.id), action: 'onboardingCreateTicket' });
    logger.error({ error, tgUserId: from.id }, 'Failed to create ticket during onboarding');
    await ctx.reply(messages.ticketCreateError);
    await clearOnboardingState(tgUserId);
  }
}

/**
 * Handle contact message during onboarding
 */
export async function handleOnboardingContact(ctx: Context): Promise<boolean> {
  if (!ctx.message?.contact || !ctx.from) {
    return false;
  }

  const tgUserId = BigInt(ctx.from.id);
  const state = await getOnboardingState(tgUserId);

  if (!state || (state.step !== 'awaiting_phone' && state.step !== 'confirming_phone')) {
    return false;
  }

  const contact = ctx.message.contact;

  // Verify the contact belongs to the sender
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply(messages.phone.wrongContact);
    return true;
  }

  const user = await userRepository.findByTgUserId(tgUserId);
  if (!user) {
    logger.warn({ tgUserId: ctx.from.id }, 'Onboarding contact received but user not found');
    await clearOnboardingState(tgUserId);
    return true;
  }

  const newPhone = contact.phone_number;
  const oldPhone = user.phone;

  if (oldPhone !== newPhone) {
    await userRepository.updatePhone(user.id, newPhone);
    await eventRepository.create({
      userId: user.id,
      eventType: 'PHONE_UPDATED',
      oldValue: oldPhone ?? undefined,
      newValue: newPhone,
    });
  }

  await ctx.reply(messages.onboarding.phoneSaved, {
    reply_markup: { remove_keyboard: true },
  });

  await clearOnboardingState(tgUserId);
  logger.info({ userId: user.id, phone: newPhone }, 'Phone saved during onboarding');

  return true;
}

/**
 * Handle callback queries during onboarding
 */
export async function handleOnboardingCallback(ctx: Context): Promise<boolean> {
  if (!ctx.callbackQuery?.data || !ctx.from) {
    return false;
  }

  const data = ctx.callbackQuery.data;

  if (!data.startsWith('onboard_phone_')) {
    return false;
  }

  const tgUserId = BigInt(ctx.from.id);
  const state = await getOnboardingState(tgUserId);

  if (!state) {
    await ctx.answerCallbackQuery();
    return true;
  }

  const user = await userRepository.findByTgUserId(tgUserId);
  if (!user) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.userNotFound });
    return true;
  }

  if (data === 'onboard_phone_skip') {
    // Skip phone
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    await ctx.reply(messages.onboarding.phoneSkipped, {
      reply_markup: { remove_keyboard: true },
    });
    await clearOnboardingState(tgUserId);
    logger.info({ userId: user.id }, 'Phone skipped during onboarding');
    return true;
  }

  if (data === 'onboard_phone_yes') {
    // Confirm existing phone
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    await ctx.reply(messages.onboarding.phoneConfirmed);
    await clearOnboardingState(tgUserId);
    logger.info({ userId: user.id, phone: user.phone }, 'Phone confirmed during onboarding');
    return true;
  }

  if (data === 'onboard_phone_change') {
    // Want to change phone
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });

    await setOnboardingState(tgUserId, { ...state, step: 'awaiting_phone' });

    await ctx.reply(messages.onboarding.askPhoneChange, {
      reply_markup: buildContactKeyboard(),
    });
    await ctx.reply('', {
      reply_markup: buildChangePhoneKeyboard(),
    });
    return true;
  }

  if (data === 'onboard_phone_keep') {
    // Keep old phone
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    await ctx.reply(messages.onboarding.phoneConfirmed, {
      reply_markup: { remove_keyboard: true },
    });
    await clearOnboardingState(tgUserId);
    logger.info({ userId: user.id, phone: user.phone }, 'Old phone kept during onboarding');
    return true;
  }

  return false;
}

import { InlineKeyboard, Keyboard } from 'grammy';
import type { Context } from 'grammy';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types';
import { userRepository } from '../../db/repositories/user.repository.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { handleOnboardingContact } from './onboarding.js';
import { messages, formatMessage } from '../../config/messages.js';
import { logger } from '../../utils/logger.js';

export function buildPhoneConfirmKeyboard(
  userId: string,
  hasPhone: boolean
): InlineKeyboardMarkup | ReplyKeyboardMarkup {
  if (hasPhone) {
    return new InlineKeyboard()
      .text(messages.buttons.phoneConfirm, `phone_confirm:${userId}`)
      .text(messages.buttons.phoneChange, `phone_change:${userId}`);
  }
  return new Keyboard().requestContact(messages.buttons.sendContact).oneTime().resized();
}

export function buildPhoneConfirmMessage(phone: string | null): string {
  if (phone) {
    return formatMessage(messages.phone.requestWithPhone, { phone });
  }
  return messages.phone.requestWithoutPhone;
}

export async function phoneConfirmHandler(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery?.data || !ctx.from) {
    return;
  }

  const parts = ctx.callbackQuery.data.split(':');
  if (parts[0] !== 'phone_confirm' || !parts[1]) {
    return;
  }

  const userId = parts[1];
  const user = await userRepository.findById(userId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.userNotFound });
    return;
  }

  if (user.tgUserId !== BigInt(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.notYourTicket });
    return;
  }

  await ctx.answerCallbackQuery({ text: messages.callbacks.phoneConfirmed });

  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // Message might already be edited
  }

  logger.info({ userId, phone: user.phone }, 'Phone confirmed by user');
}

export async function phoneChangeHandler(ctx: Context): Promise<void> {
  if (!ctx.callbackQuery?.data || !ctx.from) {
    return;
  }

  const parts = ctx.callbackQuery.data.split(':');
  if (parts[0] !== 'phone_change' || !parts[1]) {
    return;
  }

  const userId = parts[1];
  const user = await userRepository.findById(userId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.userNotFound });
    return;
  }

  if (user.tgUserId !== BigInt(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: messages.callbacks.notYourTicket });
    return;
  }

  await ctx.answerCallbackQuery();

  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // Message might already be edited
  }

  // Ask for contact
  await ctx.reply(messages.phone.sendContact, {
    reply_markup: new Keyboard().requestContact(messages.buttons.sendContact).oneTime().resized(),
  });
}

export async function contactHandler(ctx: Context): Promise<void> {
  if (!ctx.message?.contact || !ctx.from) {
    return;
  }

  // Check if this is part of onboarding flow
  const handledByOnboarding = await handleOnboardingContact(ctx);
  if (handledByOnboarding) {
    return;
  }

  const contact = ctx.message.contact;

  // Verify the contact belongs to the sender
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply(messages.phone.wrongContact);
    return;
  }

  const user = await userRepository.findByTgUserId(BigInt(ctx.from.id));
  if (!user) {
    logger.warn({ tgUserId: ctx.from.id }, 'Contact received from unknown user');
    await ctx.reply(messages.phone.noTicket);
    return;
  }

  const oldPhone = user.phone;
  const newPhone = contact.phone_number;

  if (oldPhone === newPhone) {
    await ctx.reply(messages.phone.alreadySaved);
    return;
  }

  await userRepository.updatePhone(user.id, newPhone);

  await eventRepository.create({
    userId: user.id,
    eventType: 'PHONE_UPDATED',
    oldValue: oldPhone ?? undefined,
    newValue: newPhone,
  });

  await ctx.reply(messages.phone.updated);

  logger.info({ userId: user.id, oldPhone, newPhone }, 'Phone updated');
}

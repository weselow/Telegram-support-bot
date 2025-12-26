import { InlineKeyboard, Keyboard } from 'grammy';
import type { Context } from 'grammy';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'grammy/types';
import { userRepository } from '../../db/repositories/user.repository.js';
import { eventRepository } from '../../db/repositories/event.repository.js';
import { logger } from '../../utils/logger.js';

export function buildPhoneConfirmKeyboard(
  userId: string,
  hasPhone: boolean
): InlineKeyboardMarkup | ReplyKeyboardMarkup {
  if (hasPhone) {
    return new InlineKeyboard()
      .text('✅ Телефон актуален', `phone_confirm:${userId}`)
      .text('📱 Изменить', `phone_change:${userId}`);
  }
  return new Keyboard().requestContact('📱 Отправить контакт').oneTime().resized();
}

export function buildPhoneConfirmMessage(phone: string | null): string {
  if (phone) {
    return `📞 Ваш телефон: ${phone}\n\nПодтвердите, что номер актуален, или обновите его.`;
  }
  return '📱 Пожалуйста, поделитесь вашим номером телефона для связи.';
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
    await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
    return;
  }

  if (user.tgUserId !== BigInt(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: 'Это не ваш тикет' });
    return;
  }

  await ctx.answerCallbackQuery({ text: 'Спасибо! Номер подтверждён' });

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
    await ctx.answerCallbackQuery({ text: 'Пользователь не найден' });
    return;
  }

  if (user.tgUserId !== BigInt(ctx.from.id)) {
    await ctx.answerCallbackQuery({ text: 'Это не ваш тикет' });
    return;
  }

  await ctx.answerCallbackQuery();

  try {
    await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
  } catch {
    // Message might already be edited
  }

  // Ask for contact
  await ctx.reply('📱 Пожалуйста, отправьте ваш контакт:', {
    reply_markup: new Keyboard().requestContact('📱 Отправить контакт').oneTime().resized(),
  });
}

export async function contactHandler(ctx: Context): Promise<void> {
  if (!ctx.message?.contact || !ctx.from) {
    return;
  }

  const contact = ctx.message.contact;

  // Verify the contact belongs to the sender
  if (contact.user_id !== ctx.from.id) {
    await ctx.reply('⚠️ Пожалуйста, отправьте свой контакт, а не чужой.');
    return;
  }

  const user = await userRepository.findByTgUserId(BigInt(ctx.from.id));
  if (!user) {
    logger.warn({ tgUserId: ctx.from.id }, 'Contact received from unknown user');
    await ctx.reply('Произошла ошибка. Пожалуйста, напишите нам сообщение для начала.');
    return;
  }

  const oldPhone = user.phone;
  const newPhone = contact.phone_number;

  if (oldPhone === newPhone) {
    await ctx.reply('✅ Ваш номер телефона уже сохранён.');
    return;
  }

  await userRepository.updatePhone(user.id, newPhone);

  await eventRepository.create({
    userId: user.id,
    eventType: 'PHONE_UPDATED',
    oldValue: oldPhone ?? undefined,
    newValue: newPhone,
  });

  await ctx.reply('✅ Номер телефона обновлён. Спасибо!');

  logger.info({ userId: user.id, oldPhone, newPhone }, 'Phone updated');
}

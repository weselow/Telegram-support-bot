import type { Api } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { escapeHtml } from '../utils/telegram-html.js';

export interface AdminInfo {
  userId: number;
  firstName: string;
  username: string | undefined;
  isOwner: boolean;
}

export async function getGroupAdmins(api: Api): Promise<AdminInfo[]> {
  const members = await api.getChatAdministrators(env.SUPPORT_GROUP_ID);

  const admins: AdminInfo[] = members
    .filter((m) => !m.user.is_bot)
    .map((m) => ({
      userId: m.user.id,
      firstName: m.user.first_name,
      username: m.user.username,
      isOwner: m.status === 'creator',
    }));

  logger.debug({ count: admins.length }, 'Retrieved group admins');
  return admins;
}

/**
 * Mentions for the HTML parse mode.
 *
 * A name is chosen by its owner, so `Иван _*[шеф]*_` is a perfectly ordinary
 * value here. Under Markdown it broke the parser and Telegram rejected the
 * whole reminder; under HTML those characters mean nothing. The username branch
 * had it worse still — an underscore is allowed in a Telegram username, so
 * @ivan_petrov failed every single time.
 */
export function formatAdminMentions(admins: AdminInfo[]): string {
  return admins
    .map((admin) =>
      admin.username
        ? `@${escapeHtml(admin.username)}`
        : `<a href="tg://user?id=${String(admin.userId)}">${escapeHtml(admin.firstName)}</a>`
    )
    .join(' ');
}

export async function sendDmToAdmins(
  api: Api,
  admins: AdminInfo[],
  message: string
): Promise<void> {
  const results = await Promise.allSettled(
    admins.map((admin) =>
      api.sendMessage(admin.userId, message, { parse_mode: 'HTML' })
    )
  );

  let sent = 0;
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      sent++;
    } else {
      const admin = admins[index];
      logger.warn(
        {
          adminId: admin?.userId,
          adminName: admin?.firstName,
          error: result.reason,
        },
        'Failed to send DM to admin (bot not started by user)'
      );
    }
  });

  if (sent === admins.length) {
    logger.info({ sent }, 'Admin DMs sent successfully');
  } else if (sent === 0 && admins.length > 0) {
    logger.error(
      { adminCount: admins.length },
      'CRITICAL: Failed to send DM to ANY admin during SLA escalation'
    );
  }
}

import type { Api } from 'grammy';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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

export function formatAdminMentions(admins: AdminInfo[]): string {
  return admins
    .map((admin) =>
      admin.username
        ? `@${admin.username}`
        : `[${admin.firstName}](tg://user?id=${String(admin.userId)})`
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
      api.sendMessage(admin.userId, message, { parse_mode: 'Markdown' })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  if (failed > 0) {
    logger.warn({ sent, failed }, 'Some admin DMs failed (bot not started by user)');
  } else {
    logger.info({ sent }, 'Admin DMs sent successfully');
  }
}

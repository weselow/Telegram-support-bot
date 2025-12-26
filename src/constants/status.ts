import type { TicketStatus } from '../generated/prisma/client.js';

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: 'Новый',
  IN_PROGRESS: 'В работе',
  WAITING_CLIENT: 'Ждём клиента',
  CLOSED: 'Закрыт',
};

export const STATUS_LABELS_WITH_EMOJI: Record<TicketStatus, string> = {
  NEW: '🆕 Новый',
  IN_PROGRESS: '🔧 В работе',
  WAITING_CLIENT: '⏳ Ждём клиента',
  CLOSED: '✅ Закрыт',
};

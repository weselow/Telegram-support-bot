import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const messagesSchema = z.object({
  welcome: z.string(),
  ticketCreated: z.string(),
  ticketCreateError: z.string(),
  deliveryFailed: z.string(),
  reopened: z.string(),

  phone: z.object({
    requestWithPhone: z.string(),
    requestWithoutPhone: z.string(),
    sendContact: z.string(),
    wrongContact: z.string(),
    noTicket: z.string(),
    alreadySaved: z.string(),
    updated: z.string(),
  }),

  status: z.object({
    changed: z.string(),
    cardUpdateFailed: z.string(),
    autocloseTimerFailed: z.string(),
  }),

  sla: z.object({
    first: z.string(),
    second: z.string(),
    escalation: z.string(),
    dmEscalation: z.string(),
  }),

  autoclose: z.object({
    client: z.string(),
    topic: z.string(),
  }),

  resolve: z.object({
    clientClosed: z.string(),
  }),

  history: z.object({
    topicOnly: z.string(),
    userNotFound: z.string(),
    empty: z.string(),
    loadError: z.string(),
  }),

  support: z.object({
    deliveryFailed: z.string(),
  }),

  callbacks: z.object({
    unknownCommand: z.string(),
    userNotFound: z.string(),
    statusAlreadySet: z.string(),
    statusChanged: z.string(),
    statusChangeError: z.string(),
    ticketNotFound: z.string(),
    notYourTicket: z.string(),
    alreadyClosed: z.string(),
    thanksClosed: z.string(),
    closeError: z.string(),
    phoneConfirmed: z.string(),
  }),

  buttons: z.object({
    phoneConfirm: z.string(),
    phoneChange: z.string(),
    sendContact: z.string(),
  }),
});

export type Messages = z.infer<typeof messagesSchema>;

function loadMessages(): Messages {
  const configPath = join(process.cwd(), 'config', 'messages.json');

  let rawData: string;
  try {
    rawData = readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw new Error(`Cannot read messages.json: ${configPath}`, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch (error) {
    throw new Error('Invalid JSON in messages.json', { cause: error });
  }

  const result = messagesSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Messages validation failed: ${result.error.toString()}`);
  }

  return result.data;
}

export const messages = loadMessages();

export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value !== undefined ? String(value) : match;
  });
}

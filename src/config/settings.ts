import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const settingsSchema = z.object({
  sla: z.object({
    firstReminderMinutes: z.number().positive(),
    secondReminderMinutes: z.number().positive(),
    escalationMinutes: z.number().positive(),
  }),
  autoclose: z.object({
    days: z.number().positive(),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

function loadSettings(): Settings {
  const configPath = join(process.cwd(), 'config', 'settings.json');

  let rawData: string;
  try {
    rawData = readFileSync(configPath, 'utf-8');
  } catch (error) {
    throw new Error(`Cannot read settings.json: ${configPath}`, { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch (error) {
    throw new Error('Invalid JSON in settings.json', { cause: error });
  }

  const result = settingsSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Settings validation failed: ${result.error.toString()}`);
  }

  return result.data;
}

export const settings = loadSettings();

// Computed values for convenience
export const slaTimings = {
  firstMs: settings.sla.firstReminderMinutes * 60 * 1000,
  secondMs: settings.sla.secondReminderMinutes * 60 * 1000,
  escalationMs: settings.sla.escalationMinutes * 60 * 1000,
};

export const autocloseTimings = {
  delayMs: settings.autoclose.days * 24 * 60 * 60 * 1000,
};

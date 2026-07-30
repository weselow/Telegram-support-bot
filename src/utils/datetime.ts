import { env } from '../config/env.js';

/**
 * Единое место, где время превращается в текст для людей.
 *
 * Сервер живёт в UTC (в контейнере переменная TZ не задана), а сотрудники
 * поддержки — в Саратове. Поэтому зону вывода задаём явно переменной
 * DISPLAY_TIMEZONE и рядом со временем печатаем смещение, чтобы в переписке
 * не приходилось угадывать, какое это время.
 */
const DISPLAY_LOCALE = 'ru-RU';

/**
 * Смещение берём у самой зоны на нужную дату, а не отдельной константой:
 * иначе при смене DISPLAY_TIMEZONE подпись разъедется с реальным временем.
 * Intl отдаёт смещение в виде «GMT+04:00» — приводим к привычному «UTC+4»,
 * минуты оставляем только там, где они есть (например «UTC+5:30» для Индии).
 */
export function getTimezoneLabel(
  date: Date = new Date(),
  timeZone: string = env.DISPLAY_TIMEZONE
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(date);

  const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(offset);

  if (!match) return 'UTC';

  const sign = match[1] ?? '+';
  const hours = String(Number(match[2] ?? '0'));
  const minutes = match[3] ?? '00';

  if (hours === '0' && minutes === '00') return 'UTC';

  return minutes === '00' ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${minutes}`;
}

/** Полная дата со временем и подписью зоны: «30.07.2026, 16:39:41 (UTC+4)». */
export function formatDateTime(date: Date): string {
  const formatted = date.toLocaleString(DISPLAY_LOCALE, {
    timeZone: env.DISPLAY_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return `${formatted} (${getTimezoneLabel(date)})`;
}

/**
 * Короткая дата без года, секунд и подписи зоны: «30.07, 16:39».
 * Используется в списках, где зона указана один раз в заголовке.
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleString(DISPLAY_LOCALE, {
    timeZone: env.DISPLAY_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

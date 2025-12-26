import * as Sentry from '@sentry/node';
import { env } from './env.js';

const packageVersion = '0.1.0';

let sentryInitialized = false;

if (env.SENTRY_DSN) {
  try {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      release: `telegram-support-bot@${packageVersion}`,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend(event) {
        if (event.extra) {
          delete event.extra.phone;
          delete event.extra.tgPhone;
        }
        return event;
      },
    });
    sentryInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

export function captureError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          if (key !== 'phone' && key !== 'tgPhone') {
            scope.setExtra(key, value);
          }
        });
      }
      Sentry.captureException(error);
    });
  } catch {
    // Sentry error should never interrupt main flow
  }
}

export function setUserContext(userId: string, extra?: Record<string, unknown>): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    Sentry.setUser({ id: userId });
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        if (key !== 'phone' && key !== 'tgPhone') {
          Sentry.setExtra(key, value);
        }
      });
    }
  } catch {
    // Sentry error should never interrupt main flow
  }
}

export function addBreadcrumb(
  category: string,
  message: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void {
  if (!sentryInitialized) {
    return;
  }

  try {
    const breadcrumb: Sentry.Breadcrumb = {
      category,
      message,
      level,
    };

    if (data) {
      breadcrumb.data = Object.fromEntries(
        Object.entries(data).filter(([key]) => key !== 'phone' && key !== 'tgPhone')
      );
    }

    Sentry.addBreadcrumb(breadcrumb);
  } catch {
    // Sentry error should never interrupt main flow
  }
}

export type { SeverityLevel } from '@sentry/node';

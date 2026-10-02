/**
 * Sentry — необязательно: включается переменной `SENTRY_DSN`. Без неё ничего не отправляется.
 */
import type { FastifyInstance } from 'fastify';

type SentryModule = typeof import('@sentry/node');

export async function initSentry(dsn: string | undefined): Promise<SentryModule | null> {
  if (!dsn) return null;
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
    // Только ошибки, без трассировки производительности.
    tracesSampleRate: 0,
  });
  return Sentry;
}

export function attachSentry(Sentry: SentryModule | null, app: FastifyInstance): void {
  if (Sentry) Sentry.setupFastifyErrorHandler(app);
}

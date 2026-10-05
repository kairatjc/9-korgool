/** Настройки сервера из переменных окружения. */
export interface ServerConfig {
  host: string;
  port: number;
  /** Адрес веб-клиента: для ссылок-приглашений, CORS и cookie сессии. */
  publicUrl: string;
  /** Строка подключения PostgreSQL; пусто — PGlite в каталоге `dataDir` (для разработки). */
  databaseUrl: string | undefined;
  dataDir: string;
  /** Redis (Valkey) для активных партий; пусто — партии только в памяти (для разработки). */
  redisUrl: string | undefined;
  /** Секрет Better Auth; пусто — Better Auth сам читает `BETTER_AUTH_SECRET`. */
  authSecret: string | undefined;
  /** Sentry DSN; пусто — Sentry выключен. */
  sentryDsn: string | undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env['HOST'] ?? '0.0.0.0',
    port: Number(env['PORT'] ?? 3000),
    publicUrl: (env['PUBLIC_URL'] ?? 'http://localhost:5173').replace(/\/+$/, ''),
    databaseUrl: env['DATABASE_URL'] || undefined,
    dataDir: env['DATA_DIR'] || '.data/pglite',
    redisUrl: env['REDIS_URL'] || undefined,
    authSecret: env['BETTER_AUTH_SECRET'] || undefined,
    sentryDsn: env['SENTRY_DSN'] || undefined,
  };
}

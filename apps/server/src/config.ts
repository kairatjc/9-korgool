/** Настройки сервера из переменных окружения. */
export interface ServerConfig {
  host: string;
  port: number;
  /** Адрес веб-клиента: для ссылок-приглашений и CORS. */
  publicUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env['HOST'] ?? '0.0.0.0',
    port: Number(env['PORT'] ?? 3000),
    publicUrl: (env['PUBLIC_URL'] ?? 'http://localhost:5173').replace(/\/+$/, ''),
  };
}

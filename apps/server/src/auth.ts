import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { fromNodeHeaders } from 'better-auth/node';
import { anonymous } from 'better-auth/plugins';
import type { IncomingHttpHeaders } from 'node:http';
import type { Player } from '@korgool/protocol';
import { schema, type Db } from './db';
import { guestName } from './guests';

export interface AuthOptions {
  db: Db;
  /** Адрес клиента: Better Auth проверяет по нему Origin и ставит cookie на этот домен. */
  publicUrl: string;
  /** Секрет подписи cookie; без него Better Auth берёт `BETTER_AUTH_SECRET` из окружения. */
  secret?: string | undefined;
}

/**
 * Аккаунты Better Auth в PostgreSQL. Пока только гости (плагин `anonymous`): клиент вызывает
 * `POST /api/auth/sign-in/anonymous` и получает cookie сессии `HttpOnly`.
 * Вход через Google позже привяжется к тому же гостю (`onLinkAccount`).
 */
export function createAuth(options: AuthOptions) {
  return betterAuth({
    baseURL: options.publicUrl,
    basePath: '/api/auth',
    ...(options.secret ? { secret: options.secret } : {}),
    database: drizzleAdapter(options.db, { provider: 'pg', schema }),
    session: {
      // Гость, который заходит хотя бы раз в 90 дней, остаётся тем же игроком.
      expiresIn: 90 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    advanced: { ipAddress: { ipAddressHeaders: ['x-forwarded-for'] } },
    telemetry: { enabled: false },
    plugins: [anonymous({ generateName: () => guestName() })],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** Игрок по cookie сессии из заголовков запроса (рукопожатие Socket.IO). */
export async function playerFromHeaders(
  auth: Auth,
  headers: IncomingHttpHeaders,
): Promise<Player | null> {
  const found = await auth.api.getSession({ headers: fromNodeHeaders(headers) });
  return found ? { id: found.user.id, name: found.user.name } : null;
}

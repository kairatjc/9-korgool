import Fastify, { type FastifyServerOptions } from 'fastify';
import { Server } from 'socket.io';
import { createAuth } from './auth';
import type { Db } from './db';
import type { GameTimeouts } from './game';
import { saveFinishedGame } from './history';
import { realScheduler, type Scheduler } from './scheduler';
import { attachGameHandlers, type GameServer } from './socket';

export interface AppOptions {
  publicUrl: string;
  db: Db;
  authSecret?: string | undefined;
  logger?: FastifyServerOptions['logger'];
  scheduler?: Scheduler;
  timeouts?: GameTimeouts;
  onError?: (error: unknown, event: string) => void;
}

/** Fastify (REST: вход, здоровье) + Socket.IO (партии) на одном HTTP-сервере. */
export function buildApp(options: AppOptions) {
  const app = Fastify({ logger: options.logger ?? false });
  const auth = createAuth({
    db: options.db,
    publicUrl: options.publicUrl,
    secret: options.authSecret,
  });

  const io: GameServer = new Server(app.server, {
    cors: { origin: options.publicUrl, credentials: true },
  });
  const scheduler = options.scheduler ?? realScheduler;
  const report = (error: unknown, event: string) => {
    app.log.error({ err: error, event }, 'socket handler failed');
    options.onError?.(error, event);
  };
  // Запись в историю идёт в фоне; при остановке сервера дожидаемся незаконченных.
  const saving = new Set<Promise<void>>();
  const { games } = attachGameHandlers(io, {
    auth,
    publicUrl: options.publicUrl,
    scheduler,
    ...(options.timeouts ? { timeouts: options.timeouts } : {}),
    onError: report,
    onFinished: (game) => {
      const save = saveFinishedGame(options.db, game, scheduler.now()).catch((error: unknown) =>
        report(error, 'history'),
      );
      saving.add(save);
      void save.finally(() => saving.delete(save));
    },
  });

  // Better Auth работает с Fetch API: переводим запрос Fastify в Request и обратно.
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers.append(key, String(value));
      }
      // Адрес клиента для ограничения частоты входов: за Caddy он уже в X-Forwarded-For.
      if (!headers.has('x-forwarded-for')) headers.set('x-forwarded-for', request.ip);
      const response = await auth.handler(
        new Request(new URL(request.url, options.publicUrl), {
          method: request.method,
          headers,
          ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
        }),
      );
      reply.status(response.status);
      for (const [key, value] of response.headers) {
        if (key !== 'set-cookie') reply.header(key, value);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(response.body ? await response.text() : null);
    },
  });

  app.get('/health', async () => ({ ok: true, games: games.size }));

  app.addHook('onClose', async () => {
    games.clear();
    await io.close();
    await Promise.all(saving);
  });

  return { app, io, games, auth };
}

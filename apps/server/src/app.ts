import Fastify, { type FastifyServerOptions } from 'fastify';
import { Server } from 'socket.io';
import type { GameTimeouts } from './game';
import { realScheduler, type Scheduler } from './scheduler';
import { attachGameHandlers, type GameServer } from './socket';

export interface AppOptions {
  publicUrl: string;
  logger?: FastifyServerOptions['logger'];
  scheduler?: Scheduler;
  timeouts?: GameTimeouts;
  onError?: (error: unknown, event: string) => void;
}

/** Fastify (REST, здоровье) + Socket.IO (партии) на одном HTTP-сервере. */
export function buildApp(options: AppOptions) {
  const app = Fastify({ logger: options.logger ?? false });

  const io: GameServer = new Server(app.server, {
    cors: { origin: options.publicUrl },
  });
  const { games } = attachGameHandlers(io, {
    publicUrl: options.publicUrl,
    scheduler: options.scheduler ?? realScheduler,
    ...(options.timeouts ? { timeouts: options.timeouts } : {}),
    onError: (error, event) => {
      app.log.error({ err: error, event }, 'socket handler failed');
      options.onError?.(error, event);
    },
  });

  app.get('/health', async () => ({ ok: true, games: games.size }));

  app.addHook('onClose', async () => {
    games.clear();
    await io.close();
  });

  return { app, io, games };
}

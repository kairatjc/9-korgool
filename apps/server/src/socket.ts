import {
  createGameSchema,
  drawAnswerSchema,
  emptySchema,
  gameRefSchema,
  moveSchema,
  type Ack,
  type ClientToServerEvents,
  type ErrorCode,
  type Player,
  type Session,
  type ServerToClientEvents,
  type Side,
} from '@korgool/protocol';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { GameOutput, OnlineGame } from './game';
import { GameRegistry, type GameRegistryOptions } from './games';
import { GuestSessions } from './guests';
import { Matchmaker } from './queue';

interface SocketData {
  player: Player;
  /** Партии, к которым подключён этот сокет, и сторона игрока в них. */
  games: Map<string, Side>;
  /** Сессия создана при этом подключении — клиенту нужно отправить токен. */
  session: Session | null;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

export interface GameSocketOptions extends GameRegistryOptions {
  /** Адрес клиента для ссылок-приглашений: `${publicUrl}/g/AB12CD`. */
  publicUrl: string;
  /** Ошибка в обработчике события: в лог и Sentry. Клиент получает `server_error`. */
  onError?: (error: unknown, event: string) => void;
}

const sideRoom = (gameId: string, side: Side) => `${gameId}:${side}`;

/** Подключает обработчики партий к серверу Socket.IO. */
export function attachGameHandlers(io: GameServer, options: GameSocketOptions) {
  const guests = new GuestSessions();
  const report = options.onError ?? ((error: unknown) => console.error(error));

  const outputFor = (gameId: string): GameOutput => ({
    start(game) {
      for (const side of ['white', 'black'] as const) {
        const player = game.seats[side];
        if (player) io.to(sideRoom(gameId, side)).emit('game:start', game.snapshot(player.id));
      }
    },
    moved: (payload) => io.to(gameId).emit('game:moved', payload),
    over: (payload) => io.to(gameId).emit('game:over', payload),
    drawOffered: (to, payload) => io.to(sideRoom(gameId, to)).emit('game:draw-offered', payload),
    drawDeclined: (to) => io.to(sideRoom(gameId, to)).emit('game:draw-declined', { gameId }),
    opponentStatus: (to, payload) => io.to(sideRoom(gameId, to)).emit('opponent:status', payload),
  });

  const games = new GameRegistry(outputFor, options);
  const queue = new Matchmaker();
  const userRoom = (playerId: string) => `user:${playerId}`;

  // Гостевая сессия: по токену из `auth.token` или новая.
  io.use((socket, next) => {
    const known = guests.get(socket.handshake.auth['token']);
    const session = known ? null : guests.create();
    socket.data.player = known ?? (session as Session).player;
    socket.data.session = session;
    socket.data.games = new Map();
    next();
  });

  io.on('connection', (socket: GameSocket) => {
    const { player, session } = socket.data;
    if (session) socket.emit('session', session);
    void socket.join(userRoom(player.id));

    /** Подписать сокет на комнаты партии и отметить игрока онлайн. */
    const attach = (game: OnlineGame, side: Side) => {
      if (socket.data.games.has(game.id)) return;
      socket.data.games.set(game.id, side);
      void socket.join([game.id, sideRoom(game.id, side)]);
      game.connect(side);
    };

    on(socket, report, 'game:create', createGameSchema, (payload) => {
      const game = games.create(player, payload.timeControl, payload.color);
      const side = game.sideOf(player.id);
      if (side) attach(game, side);
      return {
        ok: true,
        game: game.snapshot(player.id),
        inviteUrl: `${options.publicUrl}/g/${game.id}`,
      };
    });

    on(socket, report, 'game:join', gameRefSchema, ({ gameId }) => {
      const game = games.get(gameId);
      if (!game) return fail('not_found');
      const joined = game.join(player);
      if (!joined.ok) return joined;
      attach(game, joined.side);
      if (joined.seated) game.start();
      return { ok: true, game: game.snapshot(player.id) };
    });

    on(socket, report, 'game:move', moveSchema, ({ gameId, pit, ply }) =>
      withGame(gameId, (game) => game.move(player.id, pit, ply)),
    );
    on(socket, report, 'game:resign', gameRefSchema, ({ gameId }) =>
      withGame(gameId, (game) => game.resign(player.id)),
    );
    on(socket, report, 'game:draw-offer', gameRefSchema, ({ gameId }) =>
      withGame(gameId, (game) => game.offerDraw(player.id)),
    );
    on(socket, report, 'game:draw-answer', drawAnswerSchema, ({ gameId, accept }) =>
      withGame(gameId, (game) => game.answerDraw(player.id, accept)),
    );

    on(socket, report, 'queue:join', emptySchema, () => {
      const pair = queue.join(player, socket.id);
      if (pair) {
        // Партия начинается сразу; игроки входят в неё через `game:join` и тем самым подключаются.
        const game = games.createMatched(...pair);
        game.start();
        for (const p of pair) io.to(userRoom(p.id)).emit('queue:matched', { gameId: game.id });
      }
      return { ok: true };
    });
    on(socket, report, 'queue:leave', emptySchema, () => {
      queue.leave(player.id);
      return { ok: true };
    });

    socket.on('disconnect', () => {
      queue.dropSocket(player.id, socket.id);
      for (const [gameId, side] of socket.data.games) games.get(gameId)?.disconnect(side);
      socket.data.games.clear();
    });
  });

  function withGame(gameId: string, fn: (game: OnlineGame) => Ack): Ack {
    const game = games.get(gameId);
    return game ? fn(game) : fail('not_found');
  }

  return { games, guests, queue };
}

const fail = (error: ErrorCode) => ({ ok: false, error }) as const;

/**
 * Обработчик события с проверкой данных схемой. Ответ уходит в подтверждение,
 * если клиент его запросил.
 */
function on<E extends keyof ClientToServerEvents, S extends z.ZodType>(
  socket: GameSocket,
  report: (error: unknown, event: string) => void,
  event: E,
  schema: S,
  handler: (payload: z.infer<S>) => Ack<object>,
) {
  const listener = (raw: unknown, ack: unknown) => {
    const parsed = schema.safeParse(raw);
    let response: Ack<object>;
    try {
      response = parsed.success ? handler(parsed.data) : fail('invalid_payload');
    } catch (error) {
      // Ошибка в одной партии не должна ронять сервер со всеми остальными.
      report(error, event);
      response = fail('server_error');
    }
    if (typeof ack === 'function') (ack as (r: Ack<object>) => void)(response);
  };
  socket.on(event, listener as never);
}

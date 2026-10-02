import type {
  Ack,
  ClientToServerEvents,
  GameSnapshot,
  ServerToClientEvents,
  Session,
} from '@korgool/protocol';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: ReturnType<typeof buildApp>['app'];
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  ({ app } = buildApp({
    publicUrl: 'https://korgool.test',
    timeouts: { firstMoveMs: 2_000, disconnectMs: 300 },
  }));
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  url = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await app.close();
});

/** Подключиться гостем; без токена сервер выдаёт новую сессию. */
async function guest(token?: string): Promise<{ socket: Client; session: Session | null }> {
  const socket: Client = connect(url, {
    transports: ['websocket'],
    forceNew: true,
    auth: token ? { token } : {},
  });
  clients.push(socket);
  if (token) {
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
    return { socket, session: null };
  }
  const session = await new Promise<Session>((resolve) => socket.once('session', resolve));
  return { socket, session };
}

function next<E extends keyof ServerToClientEvents>(socket: Client, event: E) {
  return new Promise<Parameters<ServerToClientEvents[E]>[0]>((resolve) =>
    socket.once(event as 'session', resolve as never),
  );
}

function send<E extends keyof ClientToServerEvents>(
  socket: Client,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<Ack<Record<string, unknown>>> {
  return new Promise((resolve) =>
    (socket.emit as (...args: unknown[]) => void)(event, payload, resolve),
  );
}

/** Алиса создаёт партию 5+3 за белых, Бек входит по коду. */
async function startGame() {
  const a = await guest();
  const b = await guest();
  const created = await send(a.socket, 'game:create', {
    timeControl: { initial: 300, increment: 3 },
    color: 'white',
  });
  if (!created.ok) throw new Error(created.error);
  const game = created['game'] as GameSnapshot;
  const startA = next(a.socket, 'game:start');
  const joined = await send(b.socket, 'game:join', { gameId: game.gameId.toLowerCase() });
  if (!joined.ok) throw new Error(joined.error);
  return { a, b, gameId: game.gameId, created, joined, startA: await startA };
}

describe('сервер партий', () => {
  it('отвечает на /health', async () => {
    const res = await fetch(`${url}/health`);
    expect(await res.json()).toEqual({ ok: true, games: 0 });
  });

  it('гость получает сессию с ником', async () => {
    const { session } = await guest();
    expect(session?.player.name).toMatch(/^Гость_/);
    expect(session?.token.length).toBeGreaterThan(20);
  });

  it('партия по ссылке: создать, войти, сходить', async () => {
    const { a, b, gameId, created, joined, startA } = await startGame();
    expect(created['inviteUrl']).toBe(`https://korgool.test/g/${gameId}`);
    expect(gameId).toMatch(/^[A-Z2-9]{6}$/);
    expect(joined['game']).toMatchObject({ phase: 'playing', you: 'black' });
    expect(startA).toMatchObject({ gameId, phase: 'playing', you: 'white' });

    const movedB = next(b.socket, 'game:moved');
    expect(await send(b.socket, 'game:move', { gameId, pit: 1, ply: 0 })).toEqual({
      ok: false,
      error: 'not_your_turn',
    });
    expect(await send(a.socket, 'game:move', { gameId, pit: 7, ply: 0 })).toEqual({ ok: true });
    const moved = await movedB;
    expect(moved).toMatchObject({ gameId, pit: 7, ply: 0, side: 'white' });
    expect(moved.clocks).toMatchObject({ white: 303_000, running: 'black' });
    expect(moved.events[0]).toEqual({ type: 'pickup', index: 6, count: 9 });
  });

  it('неверные данные и чужая партия', async () => {
    const { b, gameId } = await startGame();
    const c = await guest();
    expect(await send(c.socket, 'game:join', { gameId })).toEqual({
      ok: false,
      error: 'game_full',
    });
    expect(await send(c.socket, 'game:join', { gameId: 'ZZZZZZ' })).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await send(b.socket, 'game:move', { gameId, pit: 10, ply: 0 })).toEqual({
      ok: false,
      error: 'invalid_payload',
    });
    expect(
      await send(c.socket, 'game:create', {
        timeControl: { initial: 1, increment: 0 },
        color: 'white',
      }),
    ).toEqual({ ok: false, error: 'invalid_payload' });
  });

  it('реконнект: тот же токен возвращает в партию', async () => {
    const { a, b, gameId } = await startGame();
    await send(a.socket, 'game:move', { gameId, pit: 7, ply: 0 });

    const offline = next(a.socket, 'opponent:status');
    b.socket.disconnect();
    expect(await offline).toEqual({ gameId, online: false });

    const online = next(a.socket, 'opponent:status');
    const back = await guest(b.session?.token);
    const rejoined = await send(back.socket, 'game:join', { gameId });
    expect(rejoined).toMatchObject({
      ok: true,
      game: { you: 'black', moves: [7], phase: 'playing' },
    });
    expect(await online).toEqual({ gameId, online: true });

    const over = next(a.socket, 'game:over');
    await send(back.socket, 'game:resign', { gameId });
    expect(await over).toMatchObject({ gameId, result: 'white_won', reason: 'resign' });
  });

  it('не вернулся вовремя — поражение', async () => {
    const { a, b, gameId } = await startGame();
    await send(a.socket, 'game:move', { gameId, pit: 7, ply: 0 });
    const over = next(a.socket, 'game:over');
    b.socket.disconnect();
    expect(await over).toMatchObject({ gameId, result: 'white_won', reason: 'disconnect' });
  });

  it('ничья по согласию', async () => {
    const { a, b, gameId } = await startGame();
    const offered = next(b.socket, 'game:draw-offered');
    await send(a.socket, 'game:draw-offer', { gameId });
    expect(await offered).toEqual({ gameId, by: 'white' });
    const over = next(a.socket, 'game:over');
    await send(b.socket, 'game:draw-answer', { gameId, accept: true });
    expect(await over).toMatchObject({ result: 'draw', reason: 'draw_agreed' });
  });

  it('очередь подбора: двое получают партию 5+3 и входят в неё', async () => {
    const a = await guest();
    const b = await guest();
    expect(await send(a.socket, 'queue:join', {})).toEqual({ ok: true });
    const matchedA = next(a.socket, 'queue:matched');
    const matchedB = next(b.socket, 'queue:matched');
    await send(b.socket, 'queue:join', {});
    const { gameId } = await matchedA;
    expect(await matchedB).toEqual({ gameId });

    const joinedA = await send(a.socket, 'game:join', { gameId });
    const joinedB = await send(b.socket, 'game:join', { gameId });
    const sides = [joinedA, joinedB].map((r) => (r.ok ? (r['game'] as GameSnapshot).you : null));
    expect(sides.sort()).toEqual(['black', 'white']);
    expect(joinedA).toMatchObject({
      ok: true,
      game: { kind: 'queue', phase: 'playing', timeControl: { initial: 300, increment: 3 } },
    });
  });

  it('ушедший из очереди не получает соперника', async () => {
    const a = await guest();
    const b = await guest();
    await send(a.socket, 'queue:join', {});
    await send(a.socket, 'queue:leave', {});
    await send(b.socket, 'queue:join', {});
    // Если бы Алиса осталась в очереди, Бек сыграл бы с ней, и Чолпон некого было бы найти.
    const c = await guest();
    const matchedC = next(c.socket, 'queue:matched');
    await send(c.socket, 'queue:join', {});
    expect(await matchedC).toHaveProperty('gameId');
  });
});

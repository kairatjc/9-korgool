/* Connection to the game server (apps/server): guest session, games with a friend.
   socket.io-client is loaded on demand, so offline modes do not pay for it. */
import type { Pit } from '@korgool/engine';
import type {
  Ack,
  ClientToServerEvents,
  ColorChoice,
  ErrorCode,
  GameMoved,
  GameOver,
  GameSnapshot,
  ServerToClientEvents,
  TimeControl,
} from '@korgool/protocol';
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const TOKEN_KEY = 'k.token';
const ACK_TIMEOUT = 10_000;

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let client: Promise<Client> | null = null;

/** The shared socket. Same origin by default (Vite proxies /socket.io in dev); `VITE_SERVER_URL` overrides. */
export function getSocket(): Promise<Client> {
  client ??= import('socket.io-client').then(({ io }) => {
    const url = (import.meta.env['VITE_SERVER_URL'] as string | undefined) || undefined;
    const opts = { auth: (cb: (data: object) => void) => cb({ token: readToken() }) };
    const socket: Client = url ? io(url, opts) : io(opts);
    socket.on('session', (session) => {
      try {
        localStorage.setItem(TOKEN_KEY, session.token);
      } catch {
        /* storage unavailable: a new guest after reload */
      }
    });
    return socket;
  });
  return client;
}

export type OnlineError = ErrorCode | 'network';

async function request<E extends keyof ClientToServerEvents, R extends object>(
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<Ack<R> | { ok: false; error: 'network' }> {
  const socket = await getSocket();
  try {
    // Event maps make emitWithAck's overloads unwieldy for a generic event; keep `this` bound.
    const timed = socket.timeout(ACK_TIMEOUT) as unknown as {
      emitWithAck(ev: E, data: typeof payload): Promise<Ack<R>>;
    };
    return await timed.emitWithAck(event, payload);
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Time control chip ('5+3', 'none') → protocol value. */
export function parseTimeControl(label: string): TimeControl {
  const m = /^(\d+)\+(\d+)$/.exec(label);
  return m ? { initial: Number(m[1]) * 60, increment: Number(m[2]) } : null;
}

export function timeControlLabel(tc: TimeControl): string | null {
  return tc ? `${tc.initial / 60}+${tc.increment}` : null;
}

export function createGame(timeControl: TimeControl, color: ColorChoice) {
  return request<'game:create', { game: GameSnapshot; inviteUrl: string }>('game:create', {
    timeControl,
    color,
  });
}

/** m:ss, rounded up so that 0:00 means the flag. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface OnlineGame {
  game: GameSnapshot | null;
  error: OnlineError | null;
  connected: boolean;
  /** When the clocks in `game` were received (performance.now()). */
  clocksAt: number;
  /** When the opponent went offline (performance.now()), or null. */
  opponentOfflineSince: number | null;
  over: GameOver | null;
  /** Bumped when the board must be rebuilt from `game` (a move was rejected). */
  resync: number;
  move: (pit: Pit, ply: number) => void;
  resign: () => void;
  offerDraw: () => void;
  answerDraw: (accept: boolean) => void;
}

/** Join the game `gameId` (take a free seat or return to ours) and follow it. */
export function useOnlineGame(gameId: string): OnlineGame {
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<OnlineError | null>(null);
  const [connected, setConnected] = useState(true);
  const [clocksAt, setClocksAt] = useState(0);
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  const [over, setOver] = useState<GameOver | null>(null);
  const [resync, setResync] = useState(0);

  useEffect(() => {
    let active = true;
    let socket: Client | null = null;

    const apply = (snapshot: GameSnapshot) => {
      setGame(snapshot);
      setClocksAt(performance.now());
      const opp = snapshot.you === 'white' ? 'black' : 'white';
      const oppOffline = snapshot.phase === 'playing' && !snapshot.online[opp];
      setOfflineSince((since) => (oppOffline ? (since ?? performance.now()) : null));
      if (snapshot.phase === 'over' && snapshot.result && snapshot.reason)
        setOver({
          gameId: snapshot.gameId,
          result: snapshot.result,
          reason: snapshot.reason,
          clocks: snapshot.clocks,
        });
    };

    const join = async () => {
      const res = await request<'game:join', { game: GameSnapshot }>('game:join', { gameId });
      if (!active) return;
      if (res.ok) {
        setError(null);
        apply(res.game);
      } else setError(res.error);
    };

    const handlers: Partial<ServerToClientEvents> = {
      'game:start': (g) => g.gameId === gameId && apply(g),
      'game:moved': (m: GameMoved) => {
        if (m.gameId !== gameId) return;
        setGame((g) =>
          g && m.ply === g.moves.length
            ? {
                ...g,
                state: m.state,
                moves: [...g.moves, m.pit],
                clocks: m.clocks,
                drawOffer: null,
              }
            : g,
        );
        setClocksAt(performance.now());
      },
      'game:over': (o) => {
        if (o.gameId !== gameId) return;
        setOver(o);
        setOfflineSince(null);
        setGame((g) =>
          g ? { ...g, phase: 'over', result: o.result, reason: o.reason, clocks: o.clocks } : g,
        );
        setClocksAt(performance.now());
      },
      'game:draw-offered': (d) =>
        d.gameId === gameId && setGame((g) => (g ? { ...g, drawOffer: d.by } : g)),
      'game:draw-declined': (d) =>
        d.gameId === gameId && setGame((g) => (g ? { ...g, drawOffer: null } : g)),
      'opponent:status': (s) => {
        if (s.gameId !== gameId) return;
        setOfflineSince(s.online ? null : performance.now());
      },
    };
    const onConnect = () => {
      setConnected(true);
      void join();
    };
    const onDisconnect = () => setConnected(false);

    void getSocket().then((s) => {
      if (!active) return;
      socket = s;
      for (const [event, fn] of Object.entries(handlers)) s.on(event as 'session', fn as never);
      s.on('connect', onConnect);
      s.on('disconnect', onDisconnect);
      setConnected(s.connected);
      // Not connected yet: the 'connect' handler joins (emits are buffered anyway, but join only once).
      if (s.connected) void join();
    });

    return () => {
      active = false;
      if (!socket) return;
      for (const [event, fn] of Object.entries(handlers))
        socket.off(event as 'session', fn as never);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [gameId]);

  const refresh = async () => {
    const res = await request<'game:join', { game: GameSnapshot }>('game:join', { gameId });
    if (res.ok) {
      setGame(res.game);
      setClocksAt(performance.now());
      setResync((n) => n + 1);
    }
  };

  return {
    game,
    error,
    connected,
    clocksAt,
    opponentOfflineSince: offlineSince,
    over,
    resync,
    move: (pit, ply) =>
      void request('game:move', { gameId, pit, ply }).then((res) => {
        // Rejected (stale position, race with a clock flag): rebuild the board from the server.
        if (!res.ok && res.error !== 'game_over') void refresh();
      }),
    resign: () => void request('game:resign', { gameId }),
    offerDraw: () => void request('game:draw-offer', { gameId }),
    answerDraw: (accept) => {
      setGame((g) => (g ? { ...g, drawOffer: null } : g));
      void request('game:draw-answer', { gameId, accept });
    },
  };
}

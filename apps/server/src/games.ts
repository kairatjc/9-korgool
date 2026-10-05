import { randomInt } from 'node:crypto';
import {
  GAME_ID_ALPHABET,
  GAME_ID_LENGTH,
  QUEUE_TIME_CONTROL,
  type ColorChoice,
  type Player,
  type Side,
  type TimeControl,
} from '@korgool/protocol';
import { DEFAULT_TIMEOUTS, OnlineGame, type GameOutput, type GameTimeouts } from './game';
import type { Scheduler } from './scheduler';

export interface GameRegistryOptions {
  scheduler: Scheduler;
  timeouts?: GameTimeouts;
  /** Сколько хранить законченную партию (чтобы игроки увидели итог после реконнекта). */
  finishedTtlMs?: number;
  /** Сколько ждать второго игрока, прежде чем удалить партию. */
  waitingTtlMs?: number;
  /** Партия закончилась (после рассылки `game:over`): записать в историю. */
  onFinished?: (game: OnlineGame) => void;
}

/**
 * Активные партии в памяти процесса; законченные уходят в историю (`onFinished`).
 * Позже состояние активных партий уедет в Redis (architecture.md §5).
 */
export class GameRegistry {
  private readonly games = new Map<string, OnlineGame>();
  private readonly expiry = new Map<string, () => void>();
  private readonly scheduler: Scheduler;
  private readonly timeouts: GameTimeouts;
  private readonly finishedTtlMs: number;
  private readonly waitingTtlMs: number;
  private readonly onFinished: ((game: OnlineGame) => void) | undefined;

  constructor(
    private readonly outputFor: (gameId: string) => GameOutput,
    options: GameRegistryOptions,
  ) {
    this.scheduler = options.scheduler;
    this.timeouts = options.timeouts ?? DEFAULT_TIMEOUTS;
    this.finishedTtlMs = options.finishedTtlMs ?? 10 * 60_000;
    this.waitingTtlMs = options.waitingTtlMs ?? 24 * 60 * 60_000;
    this.onFinished = options.onFinished;
  }

  get size(): number {
    return this.games.size;
  }

  get(id: string): OnlineGame | null {
    return this.games.get(id) ?? null;
  }

  create(creator: Player, timeControl: TimeControl, color: ColorChoice): OnlineGame {
    const game = this.newGame(timeControl);
    const side: Side = color === 'random' ? randomSide() : color;
    game.seat(side, creator);
    return game;
  }

  /** Партия из очереди подбора: 5+3, цвета случайно. Вызывающий подключает игроков и вызывает `start()`. */
  createMatched(a: Player, b: Player): OnlineGame {
    const game = this.newGame(QUEUE_TIME_CONTROL);
    game.kind = 'queue';
    const [white, black] = randomSide() === 'white' ? [a, b] : [b, a];
    game.seat('white', white);
    game.seat('black', black);
    return game;
  }

  private newGame(timeControl: TimeControl): OnlineGame {
    const id = this.newId();
    const output = this.outputFor(id);
    const game = new OnlineGame(
      id,
      timeControl,
      {
        ...output,
        start: (g) => {
          this.cancelExpiry(id);
          output.start(g);
        },
        over: (payload) => {
          this.expireIn(id, this.finishedTtlMs);
          output.over(payload);
          this.onFinished?.(game);
        },
      },
      this.scheduler,
      this.timeouts,
    );
    this.games.set(id, game);
    this.expireIn(id, this.waitingTtlMs);
    return game;
  }

  /** Остановить таймеры всех партий (при остановке сервера). */
  clear(): void {
    for (const cancel of this.expiry.values()) cancel();
    for (const game of this.games.values()) game.dispose();
    this.expiry.clear();
    this.games.clear();
  }

  private newId(): string {
    for (;;) {
      let id = '';
      for (let i = 0; i < GAME_ID_LENGTH; i++)
        id += GAME_ID_ALPHABET[randomInt(GAME_ID_ALPHABET.length)];
      if (!this.games.has(id)) return id;
    }
  }

  private expireIn(id: string, ms: number): void {
    this.cancelExpiry(id);
    this.expiry.set(
      id,
      this.scheduler.after(ms, () => {
        this.expiry.delete(id);
        this.games.get(id)?.dispose();
        this.games.delete(id);
      }),
    );
  }

  private cancelExpiry(id: string): void {
    this.expiry.get(id)?.();
    this.expiry.delete(id);
  }
}

function randomSide(): Side {
  return randomInt(2) === 0 ? 'white' : 'black';
}

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
import {
  DEFAULT_TIMEOUTS,
  OnlineGame,
  type GameOutput,
  type GameTimeouts,
  type SavedGame,
} from './game';
import type { Scheduler } from './scheduler';
import type { GameStore } from './store';

export interface GameRegistryOptions {
  scheduler: Scheduler;
  timeouts?: GameTimeouts;
  /** Сколько хранить законченную партию (чтобы игроки увидели итог после реконнекта). */
  finishedTtlMs?: number;
  /** Сколько ждать второго игрока, прежде чем удалить партию. */
  waitingTtlMs?: number;
  /** Партия закончилась (после рассылки `game:over`): записать в историю. */
  onFinished?: (game: OnlineGame) => void;
  /** Куда сохранять партии после каждого изменения (Redis); без него — только память. */
  store?: GameStore;
  /** Ошибка записи в хранилище: в лог и Sentry. Партия продолжается в памяти. */
  onStoreError?: (error: unknown) => void;
}

/**
 * Активные партии. Партия живёт в памяти процесса (там её таймеры), а после каждого
 * изменения сохраняется в хранилище, откуда её поднимает `restore()` после перезапуска.
 * Законченные уходят в историю (`onFinished`).
 */
export class GameRegistry {
  private readonly games = new Map<string, OnlineGame>();
  private readonly expiry = new Map<string, () => void>();
  private readonly scheduler: Scheduler;
  private readonly timeouts: GameTimeouts;
  private readonly finishedTtlMs: number;
  private readonly waitingTtlMs: number;
  private readonly onFinished: ((game: OnlineGame) => void) | undefined;
  private readonly store: GameStore | undefined;
  private readonly onStoreError: (error: unknown) => void;
  /** Записи в хранилище по порядку: следующая идёт после предыдущей. */
  private writes: Promise<void> = Promise.resolve();

  constructor(
    private readonly outputFor: (gameId: string) => GameOutput,
    options: GameRegistryOptions,
  ) {
    this.scheduler = options.scheduler;
    this.timeouts = options.timeouts ?? DEFAULT_TIMEOUTS;
    this.finishedTtlMs = options.finishedTtlMs ?? 10 * 60_000;
    this.waitingTtlMs = options.waitingTtlMs ?? 24 * 60 * 60_000;
    this.onFinished = options.onFinished;
    this.store = options.store;
    this.onStoreError = options.onStoreError ?? ((error) => console.error(error));
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
    this.persist(game);
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

  /** Поднять партии из хранилища (при запуске сервера). Возвращает их число. */
  async restore(): Promise<number> {
    if (!this.store) return 0;
    const saved = await this.store.loadAll();
    for (const data of saved) {
      if (this.games.has(data.id)) continue;
      const game = OnlineGame.restore(
        data,
        this.wrapOutput(data.id),
        this.scheduler,
        this.timeouts,
      );
      this.games.set(data.id, game);
      if (game.phase === 'waiting') this.expireIn(data.id, this.waitingTtlMs);
      if (game.phase === 'over') this.expireIn(data.id, this.finishedTtlMs);
      this.persist(game);
    }
    return saved.length;
  }

  /**
   * Остановить таймеры всех партий (при остановке сервера). Партии остаются в хранилище
   * с часами на этот момент и продолжатся после запуска.
   */
  async close(): Promise<void> {
    for (const game of this.games.values()) this.persist(game);
    for (const cancel of this.expiry.values()) cancel();
    for (const game of this.games.values()) game.dispose();
    this.expiry.clear();
    this.games.clear();
    await this.writes;
  }

  private newGame(timeControl: TimeControl): OnlineGame {
    const id = this.newId();
    const game = new OnlineGame(
      id,
      timeControl,
      this.wrapOutput(id),
      this.scheduler,
      this.timeouts,
    );
    this.games.set(id, game);
    this.expireIn(id, this.waitingTtlMs);
    return game;
  }

  /** Вывод партии + продление срока жизни и сохранение после каждого события. */
  private wrapOutput(id: string): GameOutput {
    const output = this.outputFor(id);
    const after = (fn: () => void) => {
      fn();
      const game = this.games.get(id);
      if (game) this.persist(game);
    };
    return {
      start: (g) =>
        after(() => {
          this.cancelExpiry(id);
          output.start(g);
        }),
      moved: (payload) => after(() => output.moved(payload)),
      over: (payload) =>
        after(() => {
          this.expireIn(id, this.finishedTtlMs);
          output.over(payload);
          const game = this.games.get(id);
          if (game) this.onFinished?.(game);
        }),
      drawOffered: (to, payload) => after(() => output.drawOffered(to, payload)),
      drawDeclined: (to) => after(() => output.drawDeclined(to)),
      opponentStatus: (to, payload) => output.opponentStatus(to, payload),
    };
  }

  private persist(game: OnlineGame): void {
    const store = this.store;
    if (!store) return;
    const data: SavedGame = game.save();
    const ttl =
      game.phase === 'waiting'
        ? this.waitingTtlMs
        : game.phase === 'over'
          ? this.finishedTtlMs
          : null;
    this.queue(() => store.save(data, ttl));
  }

  private queue(write: () => Promise<void>): void {
    this.writes = this.writes.then(write).catch(this.onStoreError);
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
        const store = this.store;
        if (store) this.queue(() => store.remove(id));
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

import {
  applyMove,
  EngineError,
  initialState,
  isValidPit,
  opponent,
  type GameState,
  type MoveEvent,
  type Pit,
} from '@korgool/engine';
import type {
  Clocks,
  DrawOffered,
  ErrorCode,
  GameMoved,
  GameOver,
  GameOverReason,
  GameResult,
  GameKind,
  GameSnapshot,
  OpponentStatus,
  Player,
  Side,
  TimeControl,
} from '@korgool/protocol';
import type { Scheduler } from './scheduler';

/** Таймауты платформы (rules.md §8). */
export interface GameTimeouts {
  /** Партия отменяется, если первый ход не сделан за это время. */
  firstMoveMs: number;
  /** Отключившийся игрок проигрывает, если не вернулся за это время. */
  disconnectMs: number;
}

export const DEFAULT_TIMEOUTS: GameTimeouts = { firstMoveMs: 30_000, disconnectMs: 60_000 };

/** Куда партия отправляет сообщения: всем участникам или одной стороне. */
export interface GameOutput {
  start(game: OnlineGame): void;
  moved(payload: GameMoved): void;
  over(payload: GameOver): void;
  drawOffered(to: Side, payload: DrawOffered): void;
  drawDeclined(to: Side): void;
  opponentStatus(to: Side, payload: OpponentStatus): void;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };

const fail = (error: ErrorCode) => ({ ok: false, error }) as const;

type Phase = GameSnapshot['phase'];

/**
 * Онлайн-партия: места игроков, ход по правилам движка, серверные часы
 * и таймеры платформенных правил (флаг, отключение, отмена).
 *
 * Все входящие действия проверяются здесь — клиенту не доверяем.
 */
export class OnlineGame {
  readonly seats: { white: Player | null; black: Player | null } = { white: null, black: null };
  kind: GameKind = 'friend';
  phase: Phase = 'waiting';
  state: GameState = initialState();
  readonly moves: Pit[] = [];
  result: GameResult | null = null;
  reason: GameOverReason | null = null;
  drawOffer: Side | null = null;
  /** Когда партия началась (оба игрока сели), мс. */
  startedAt: number | null = null;

  /** Остаток времени на момент `turnStartedAt`, мс. */
  private readonly remaining: Record<Side, number>;
  private turnStartedAt = 0;
  private readonly connections: Record<Side, number> = { white: 0, black: 0 };

  private cancelFlag: (() => void) | null = null;
  private cancelFirstMove: (() => void) | null = null;
  private readonly cancelDisconnect: Record<Side, (() => void) | null> = {
    white: null,
    black: null,
  };

  constructor(
    readonly id: string,
    readonly timeControl: TimeControl,
    private readonly output: GameOutput,
    private readonly scheduler: Scheduler,
    private readonly timeouts: GameTimeouts = DEFAULT_TIMEOUTS,
  ) {
    const initialMs = (timeControl?.initial ?? 0) * 1000;
    this.remaining = { white: initialMs, black: initialMs };
  }

  sideOf(playerId: string): Side | null {
    if (this.seats.white?.id === playerId) return 'white';
    if (this.seats.black?.id === playerId) return 'black';
    return null;
  }

  /** Занять место `side` (создатель партии). */
  seat(side: Side, player: Player): void {
    this.seats[side] = player;
  }

  /**
   * Войти в партию: вернуть своё место (реконнект) или занять свободное.
   * `seated` — игрок только что сел на свободное место; тогда вызывающий
   * подключает его и вызывает `start()`.
   */
  join(player: Player): Result<{ side: Side; seated: boolean }> {
    const own = this.sideOf(player.id);
    if (own) return { ok: true, side: own, seated: false };
    if (this.phase !== 'waiting') return fail('game_full');
    const side: Side = this.seats.white ? 'black' : 'white';
    this.seats[side] = player;
    return { ok: true, side, seated: true };
  }

  /** Оба места заняты — партия начинается, идёт таймер первого хода. */
  start(): void {
    if (this.phase !== 'waiting' || !this.seats.white || !this.seats.black) return;
    this.phase = 'playing';
    this.startedAt = this.scheduler.now();
    this.cancelFirstMove = this.scheduler.after(this.timeouts.firstMoveMs, () =>
      this.finish('cancelled', 'no_first_move'),
    );
    this.output.start(this);
    // Игрок мог уйти, пока ждал соперника.
    for (const side of ['white', 'black'] as const) {
      if (!this.isOnline(side)) this.startDisconnectTimer(side);
    }
  }

  move(playerId: string, pit: Pit, ply: number): Result {
    const side = this.sideOf(playerId);
    if (!side) return fail('not_a_player');
    if (this.phase === 'waiting') return fail('not_started');
    if (this.phase === 'over') return fail('game_over');
    if (ply !== this.moves.length) return fail('stale_ply');
    if (side !== this.state.turn) return fail('not_your_turn');
    if (!isValidPit(pit)) return fail('illegal_move');

    const now = this.scheduler.now();
    const left = this.clockRunning()
      ? this.remaining[side] - (now - this.turnStartedAt)
      : this.remaining[side];
    if (this.timeControl && left <= 0) {
      this.flag(side);
      return fail('game_over');
    }

    let next: { state: GameState; events: readonly MoveEvent[] };
    try {
      next = applyMove(this.state, pit);
    } catch (error) {
      if (error instanceof EngineError) return fail('illegal_move');
      throw error;
    }

    // Добавка по Фишеру — после каждого хода (rules.md §8).
    if (this.timeControl) this.remaining[side] = left + this.timeControl.increment * 1000;
    this.state = next.state;
    this.moves.push(pit);
    this.drawOffer = null;
    this.turnStartedAt = now;
    this.cancelFirstMove?.();
    this.cancelFirstMove = null;
    this.cancelFlag?.();
    this.cancelFlag = null;

    this.output.moved({
      gameId: this.id,
      pit,
      ply: this.moves.length - 1,
      side,
      events: [...next.events],
      state: this.state,
      clocks: this.clocks(),
    });

    if (this.state.status !== 'playing') {
      this.finish(this.state.status, 'score');
    } else {
      this.scheduleFlag();
    }
    return { ok: true };
  }

  resign(playerId: string): Result {
    const side = this.activeSide(playerId);
    if (typeof side !== 'string') return side;
    this.finish(winner(opponent(side)), 'resign');
    return { ok: true };
  }

  offerDraw(playerId: string): Result {
    const side = this.activeSide(playerId);
    if (typeof side !== 'string') return side;
    // Встречное предложение — это согласие.
    if (this.drawOffer === opponent(side)) {
      this.finish('draw', 'draw_agreed');
      return { ok: true };
    }
    if (this.drawOffer !== side) {
      this.drawOffer = side;
      this.output.drawOffered(opponent(side), { gameId: this.id, by: side });
    }
    return { ok: true };
  }

  answerDraw(playerId: string, accept: boolean): Result {
    const side = this.activeSide(playerId);
    if (typeof side !== 'string') return side;
    if (this.drawOffer !== opponent(side)) return fail('no_draw_offer');
    if (accept) {
      this.finish('draw', 'draw_agreed');
    } else {
      this.drawOffer = null;
      this.output.drawDeclined(opponent(side));
    }
    return { ok: true };
  }

  /** Игрок открыл ещё одно соединение с партией. */
  connect(side: Side): void {
    this.connections[side] += 1;
    if (this.connections[side] !== 1) return;
    this.cancelDisconnect[side]?.();
    this.cancelDisconnect[side] = null;
    if (this.phase === 'playing') {
      this.output.opponentStatus(opponent(side), { gameId: this.id, online: true });
    }
  }

  /** Соединение игрока закрылось; без соединений через 60 с — поражение. */
  disconnect(side: Side): void {
    this.connections[side] = Math.max(0, this.connections[side] - 1);
    if (this.connections[side] !== 0 || this.phase !== 'playing') return;
    this.output.opponentStatus(opponent(side), { gameId: this.id, online: false });
    this.startDisconnectTimer(side);
  }

  isOnline(side: Side): boolean {
    return this.connections[side] > 0;
  }

  clocks(): Clocks | null {
    if (!this.timeControl) return null;
    const running = this.clockRunning() ? this.state.turn : null;
    const now = this.scheduler.now();
    const left = (side: Side) =>
      Math.max(
        0,
        Math.round(this.remaining[side] - (running === side ? now - this.turnStartedAt : 0)),
      );
    return { white: left('white'), black: left('black'), running };
  }

  snapshot(forPlayerId: string | null): GameSnapshot {
    return {
      gameId: this.id,
      kind: this.kind,
      phase: this.phase,
      timeControl: this.timeControl,
      players: { white: this.seats.white, black: this.seats.black },
      you: forPlayerId === null ? null : this.sideOf(forPlayerId),
      state: this.state,
      moves: [...this.moves],
      clocks: this.clocks(),
      drawOffer: this.drawOffer,
      online: { white: this.isOnline('white'), black: this.isOnline('black') },
      result: this.result,
      reason: this.reason,
    };
  }

  /** Остановить все таймеры (партия удаляется из памяти). */
  dispose(): void {
    this.clearTimers();
  }

  private startDisconnectTimer(side: Side): void {
    this.cancelDisconnect[side]?.();
    this.cancelDisconnect[side] = this.scheduler.after(this.timeouts.disconnectMs, () =>
      this.finish(winner(opponent(side)), 'disconnect'),
    );
  }

  /** Часы идут с первого хода; до него действует таймер отмены партии. */
  private clockRunning(): boolean {
    return this.phase === 'playing' && this.moves.length > 0;
  }

  private scheduleFlag(): void {
    if (!this.timeControl) return;
    const side = this.state.turn;
    this.cancelFlag = this.scheduler.after(this.remaining[side], () => {
      this.cancelFlag = null;
      const left = this.remaining[side] - (this.scheduler.now() - this.turnStartedAt);
      if (left <= 0) this.flag(side);
      else this.scheduleFlag();
    });
  }

  /** Флаг: у кого кончилось время, тот проиграл, независимо от счёта (rules.md §8). */
  private flag(side: Side): void {
    this.remaining[side] = 0;
    this.turnStartedAt = this.scheduler.now();
    this.finish(winner(opponent(side)), 'timeout');
  }

  private activeSide(playerId: string): Side | { ok: false; error: ErrorCode } {
    const side = this.sideOf(playerId);
    if (!side) return fail('not_a_player');
    if (this.phase === 'waiting') return fail('not_started');
    if (this.phase === 'over') return fail('game_over');
    return side;
  }

  private finish(result: GameResult, reason: GameOverReason): void {
    if (this.phase === 'over') return;
    // Заморозить часы: остаток на момент окончания.
    const clocks = this.clocks();
    if (clocks) {
      this.remaining.white = clocks.white;
      this.remaining.black = clocks.black;
    }
    this.phase = 'over';
    this.result = result;
    this.reason = reason;
    this.drawOffer = null;
    this.clearTimers();
    this.output.over({ gameId: this.id, result, reason, clocks: this.clocks() });
  }

  private clearTimers(): void {
    this.cancelFlag?.();
    this.cancelFirstMove?.();
    this.cancelDisconnect.white?.();
    this.cancelDisconnect.black?.();
    this.cancelFlag = this.cancelFirstMove = null;
    this.cancelDisconnect.white = this.cancelDisconnect.black = null;
  }
}

function winner(side: Side): GameResult {
  return side === 'white' ? 'white_won' : 'black_won';
}

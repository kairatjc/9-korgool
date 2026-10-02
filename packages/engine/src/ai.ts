import { sideIndex } from './board';
import { PITS_PER_SIDE } from './constants';
import { applyMove, legalMoves } from './game';
import type { GameState, Pit, Side } from './types';

/**
 * Уровни бота (gameplay-and-features.md §1.3):
 * 1 — Бала: случайный ход с небольшим предпочтением захватов;
 * 2 — Оюнчу: жадный поиск на 2 полухода;
 * 3 — Чебер: минимакс с альфа-бета-отсечением, глубина 6;
 * 4 — Устат: пока тот же поиск глубже (7). Итеративное углубление, таблица
 *     транспозиций и лимит по времени — на этапе 4 дорожной карты.
 */
export type BotLevel = 1 | 2 | 3 | 4;
export const BOT_LEVELS: readonly BotLevel[] = [1, 2, 3, 4];

export function isBotLevel(v: unknown): v is BotLevel {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

export interface ChooseMoveOptions {
  /** Источник случайности в [0, 1) — для воспроизводимых тестов. */
  random?: () => number;
}

/** Во сколько раз уровень 1 чаще выбирает ход с захватом или туздуком. */
const CAPTURE_WEIGHT = 3;
const DEPTH = { 2: 2, 3: 6, 4: 7 } as const;

const WIN = 10_000;
/** Туздук до конца партии приносит шарики, поэтому стоит больше трёх взятых шариков. */
const TUZDYK_BONUS = 6;
/** Вес одного доступного хода (мобильность) — меньше одного шарика. */
const MOBILITY = 0.1;

/** Ход бота (лунка 1..9) для игрока, чья очередь, или `null`, если ходов нет. */
export function chooseMove(
  state: GameState,
  level: BotLevel,
  { random = Math.random }: ChooseMoveOptions = {},
): Pit | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  if (level === 1) return weightedRandom(state, moves, random);

  const depth = DEPTH[level];
  const side = state.turn;
  const fullEval = level >= 3;
  let best: Pit[] = [];
  let bestV = -Infinity;
  for (const pit of order(state, moves)) {
    const next = applyMove(state, pit).state;
    // Окно (bestV - 1, +∞): ходы, равные лучшему, тоже оцениваются точно — среди них выбираем случайно.
    const v = search(next, depth - 1, bestV - 1, Infinity, side, fullEval, 1);
    if (v > bestV) {
      bestV = v;
      best = [pit];
    } else if (v === bestV) {
      best.push(pit);
    }
  }
  return pick(best, random);
}

/** Оценка позиции с точки зрения `side`: разница казанов, туздуки, мобильность. */
export function evaluate(state: GameState, side: Side, full = true): number {
  const me = sideIndex(side);
  const opp = me === 0 ? 1 : 0;
  if (state.status === 'draw') return 0;
  if (state.status !== 'playing') return state.status === `${side}_won` ? WIN : -WIN;
  let v = state.kazans[me] - state.kazans[opp];
  if (!full) return v;
  v +=
    (state.tuzdyks[me] !== null ? TUZDYK_BONUS : 0) -
    (state.tuzdyks[opp] !== null ? TUZDYK_BONUS : 0);
  v += MOBILITY * (nonEmpty(state, me) - nonEmpty(state, opp));
  return v;
}

function search(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  side: Side,
  full: boolean,
  ply: number,
): number {
  if (state.status !== 'playing') {
    const v = evaluate(state, side);
    // Быстрая победа лучше далёкой, далёкое поражение лучше близкого.
    return v > 0 ? v - ply : v < 0 ? v + ply : 0;
  }
  if (depth === 0) return evaluate(state, side, full);
  const maximize = state.turn === side;
  let best = maximize ? -Infinity : Infinity;
  for (const pit of order(state, legalMoves(state))) {
    const v = search(applyMove(state, pit).state, depth - 1, alpha, beta, side, full, ply + 1);
    if (maximize) {
      if (v > best) best = v;
      if (v > alpha) alpha = v;
    } else {
      if (v < best) best = v;
      if (v < beta) beta = v;
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** Порядок перебора для отсечений: сначала ходы, которые сразу берут шарики. */
function order(state: GameState, moves: Pit[]): Pit[] {
  if (moves.length < 2) return moves;
  const me = sideIndex(state.turn);
  const gain = new Map<Pit, number>();
  for (const pit of moves) {
    const { state: next, record } = applyMove(state, pit);
    gain.set(pit, next.kazans[me] - state.kazans[me] + (record.tuzdyk ? TUZDYK_BONUS : 0));
  }
  return [...moves].sort((a, b) => (gain.get(b) ?? 0) - (gain.get(a) ?? 0));
}

function weightedRandom(state: GameState, moves: Pit[], random: () => number): Pit | null {
  const weights = moves.map((pit) => {
    const { record } = applyMove(state, pit);
    return record.capture || record.tuzdyk ? CAPTURE_WEIGHT : 1;
  });
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return moves[i] ?? null;
  }
  return moves[moves.length - 1] ?? null;
}

function pick(moves: Pit[], random: () => number): Pit | null {
  return moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))] ?? null;
}

function nonEmpty(state: GameState, side: 0 | 1): number {
  let n = 0;
  const start = side * PITS_PER_SIDE;
  for (let i = start; i < start + PITS_PER_SIDE; i++) if ((state.pits[i] ?? 0) > 0) n++;
  return n;
}

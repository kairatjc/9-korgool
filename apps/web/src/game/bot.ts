/* A small placeholder bot until the engine gets its own AI (docs/architecture.md, engine/ai):
   alpha-beta search over the real engine, depth by level. Level 1 plays a random legal move. */
import { applyMove, legalMoves, type GameState, type Pit, type Side } from '@korgool/engine';

const DEPTH = { 1: 0, 2: 1, 3: 3, 4: 5 } as const;
export type Level = keyof typeof DEPTH;
export const isLevel = (v: number): v is Level => v === 1 || v === 2 || v === 3 || v === 4;

const WIN = 1000;
const TUZDYK_BONUS = 6;

function evaluate(s: GameState, side: Side): number {
  const me = side === 'white' ? 0 : 1;
  const opp = me === 0 ? 1 : 0;
  if (s.status === 'draw') return 0;
  if (s.status !== 'playing') return (s.status === `${side}_won` ? 1 : -1) * WIN;
  const tz =
    (s.tuzdyks[me] !== null ? TUZDYK_BONUS : 0) - (s.tuzdyks[opp] !== null ? TUZDYK_BONUS : 0);
  return s.kazans[me] - s.kazans[opp] + tz;
}

function search(s: GameState, depth: number, alpha: number, beta: number, side: Side): number {
  if (depth === 0 || s.status !== 'playing') return evaluate(s, side);
  const maximize = s.turn === side;
  let best = maximize ? -Infinity : Infinity;
  for (const pit of legalMoves(s)) {
    const v = search(applyMove(s, pit).state, depth - 1, alpha, beta, side);
    if (maximize) {
      best = Math.max(best, v);
      alpha = Math.max(alpha, v);
    } else {
      best = Math.min(best, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/** Best move (pit 1..9) for the player to move, or `null` if there is none. */
export function chooseMove(
  s: GameState,
  level: Level,
  random: () => number = Math.random,
): Pit | null {
  const moves = legalMoves(s);
  if (moves.length === 0) return null;
  const depth = DEPTH[level];
  if (depth === 0) return moves[Math.floor(random() * moves.length)] ?? null;
  let best: Pit | null = null,
    bestV = -Infinity;
  for (const pit of moves) {
    const v = search(applyMove(s, pit).state, depth - 1, -Infinity, Infinity, s.turn);
    if (v > bestV) {
      bestV = v;
      best = pit;
    }
  }
  return best;
}

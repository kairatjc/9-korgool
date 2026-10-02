import { indexToPit, opponent, pitToIndex, sideIndex, sideIndices } from './board';
import {
  BOARD_SIZE,
  DRAW_SCORE,
  INITIAL_PIT_COUNT,
  PITS_PER_SIDE,
  WIN_THRESHOLD,
} from './constants';
import {
  EngineError,
  type GameState,
  type GameStatus,
  type MoveEvent,
  type MoveResult,
  type Pit,
  type Side,
} from './types';

export function initialState(): GameState {
  return {
    pits: Array.from({ length: BOARD_SIZE }, () => INITIAL_PIT_COUNT),
    kazans: [0, 0],
    tuzdyks: [null, null],
    turn: 'white',
    status: 'playing',
  };
}

/** Чей туздук находится в лунке с этим индексом (или `null`). */
export function tuzdykOwner(state: Pick<GameState, 'tuzdyks'>, index: number): Side | null {
  if (state.tuzdyks[0] === index) return 'white';
  if (state.tuzdyks[1] === index) return 'black';
  return null;
}

/** Номера лунок (1..9), из которых игрок, чей сейчас ход, может сходить. */
export function legalMoves(state: GameState): Pit[] {
  if (state.status !== 'playing') return [];
  return sideIndices(state.turn)
    .filter((index) => (state.pits[index] ?? 0) > 0)
    .map((index) => indexToPit(index).pit);
}

/**
 * Может ли `side` объявить туздуком лунку соперника с индексом `index` (rules.md §5).
 * Проверяет только ограничения, а не то, что в лунке ровно 3 шарика.
 */
export function canCreateTuzdyk(
  state: Pick<GameState, 'tuzdyks'>,
  side: Side,
  index: number,
): boolean {
  const { side: pitSide, pit } = indexToPit(index);
  if (pitSide === side) return false;
  if (state.tuzdyks[sideIndex(side)] !== null) return false;
  if (pit === PITS_PER_SIDE) return false;
  const opponentTuzdyk = state.tuzdyks[sideIndex(opponent(side))] ?? null;
  if (opponentTuzdyk !== null && indexToPit(opponentTuzdyk).pit === pit) return false;
  return true;
}

/** Применяет ход игрока, чья очередь, из лунки `pit` (1..9). */
export function applyMove(state: GameState, pit: Pit): MoveResult {
  if (state.status !== 'playing') throw new EngineError('Партия уже окончена');

  const side = state.turn;
  const me = sideIndex(side);
  const from = pitToIndex(side, pit);
  const count = state.pits[from] ?? 0;
  if (count === 0) throw new EngineError(`Лунка ${pit} пуста`);

  const pits = [...state.pits];
  const kazans: [number, number] = [state.kazans[0], state.kazans[1]];
  const tuzdyks: [number | null, number | null] = [state.tuzdyks[0], state.tuzdyks[1]];
  const events: MoveEvent[] = [{ type: 'pickup', index: from, count }];

  // Если шарик один — он уходит в следующую лунку, иначе первый кладётся обратно.
  pits[from] = 0;
  const start = count === 1 ? (from + 1) % BOARD_SIZE : from;
  let last = start;
  for (let k = 0; k < count; k++) {
    last = (start + k) % BOARD_SIZE;
    const owner = tuzdykOwner({ tuzdyks }, last);
    if (owner === null) {
      pits[last] = (pits[last] ?? 0) + 1;
    } else {
      kazans[sideIndex(owner)] += 1;
    }
    events.push({ type: 'sow', index: last, toKazan: owner });
  }

  let capture = false;
  let tuzdyk = false;
  const landedOnOpponent = indexToPit(last).side !== side;
  if (landedOnOpponent && tuzdykOwner({ tuzdyks }, last) === null) {
    const n = pits[last] ?? 0;
    if (n % 2 === 0) {
      kazans[me] += n;
      pits[last] = 0;
      capture = true;
      events.push({ type: 'capture', index: last, count: n, by: side });
    } else if (n === 3 && canCreateTuzdyk({ tuzdyks }, side, last)) {
      kazans[me] += n;
      pits[last] = 0;
      tuzdyks[me] = last;
      tuzdyk = true;
      events.push({ type: 'tuzdyk', index: last, by: side });
    }
  }

  const next = opponent(side);
  let status = statusByScore(kazans);

  // Нет хода у следующего игрока: сходивший забирает шарики со своей стороны (rules.md §6).
  if (status === 'playing' && sideIndices(next).every((i) => (pits[i] ?? 0) === 0)) {
    let collected = 0;
    for (const i of sideIndices(side)) {
      collected += pits[i] ?? 0;
      pits[i] = 0;
    }
    kazans[me] += collected;
    events.push({ type: 'collect', side, count: collected });
    status = statusByScore(kazans, true);
  }

  if (status !== 'playing') events.push({ type: 'game_over', status });

  return {
    state: { pits, kazans, tuzdyks, turn: next, status },
    events,
    record: { side, pit, capture, tuzdyk },
  };
}

/** Применяет последовательность ходов (номера лунок) к стартовой позиции. */
export function replay(moves: readonly Pit[], from: GameState = initialState()): GameState {
  return moves.reduce((state, pit) => applyMove(state, pit).state, from);
}

/**
 * Результат по счёту в казанах. `final` — все шарики уже в казанах,
 * тогда при равенстве объявляется ничья.
 */
export function statusByScore(kazans: readonly [number, number], final = false): GameStatus {
  if (kazans[0] >= WIN_THRESHOLD) return 'white_won';
  if (kazans[1] >= WIN_THRESHOLD) return 'black_won';
  if (kazans[0] === DRAW_SCORE && kazans[1] === DRAW_SCORE) return 'draw';
  if (final) {
    if (kazans[0] > kazans[1]) return 'white_won';
    if (kazans[1] > kazans[0]) return 'black_won';
    return 'draw';
  }
  return 'playing';
}

export type Side = 'white' | 'black';

export type GameStatus = 'playing' | 'white_won' | 'black_won' | 'draw';

/** Номер лунки со стороны игрока: 1..9. */
export type Pit = number;

/**
 * Состояние партии. Иммутабельно: `applyMove` всегда возвращает новый объект.
 *
 * Доска — кольцевой массив из 18 ячеек: индексы 0..8 — лунки Белых 1..9,
 * 9..17 — лунки Чёрных 1..9. Посев идёт по возрастанию индекса.
 */
export interface GameState {
  readonly pits: readonly number[];
  /** Казаны: [белые, чёрные]. */
  readonly kazans: readonly [number, number];
  /** Индекс лунки на доске, являющейся туздуком игрока: [белые, чёрные]. */
  readonly tuzdyks: readonly [number | null, number | null];
  readonly turn: Side;
  readonly status: GameStatus;
}

/** События хода — для пошаговой анимации на клиенте. */
export type MoveEvent =
  /** Игрок взял все шарики из лунки. */
  | { type: 'pickup'; index: number; count: number }
  /** Шарик положен в лунку; если лунка — туздук, он ушёл в казан `toKazan`. */
  | { type: 'sow'; index: number; toKazan: Side | null }
  /** Захват: все шарики лунки ушли в казан игрока. */
  | { type: 'capture'; index: number; count: number; by: Side }
  /** Лунка стала туздуком игрока, её 3 шарика ушли в его казан. */
  | { type: 'tuzdyk'; index: number; by: Side }
  /** Конец партии из-за отсутствия ходов: игрок забрал шарики со своей стороны. */
  | { type: 'collect'; side: Side; count: number }
  | { type: 'game_over'; status: Exclude<GameStatus, 'playing'> };

/** Запись хода для истории партии и нотации. */
export interface MoveRecord {
  readonly side: Side;
  readonly pit: Pit;
  readonly capture: boolean;
  readonly tuzdyk: boolean;
}

export interface MoveResult {
  readonly state: GameState;
  readonly events: readonly MoveEvent[];
  readonly record: MoveRecord;
}

export class EngineError extends Error {
  override name = 'EngineError';
}

import { TOTAL_KORGOOLS, parse, type GameState } from '../src';

interface PositionInput {
  /** Лунки Белых 1..9 (недостающие — нули). */
  white?: number[];
  /** Лунки Чёрных 1..9 (недостающие — нули). */
  black?: number[];
  /**
   * Казан Белых; казан Чёрных дополняется до 162 автоматически.
   * По умолчанию недостающие шарики делятся между казанами поровну.
   */
  whiteKazan?: number;
  /** Туздуки: номер лунки соперника или `-`. */
  tuz?: [string, string];
  turn?: 'w' | 'b';
}

const pad = (row: number[] = []) => Array.from({ length: 9 }, (_, i) => row[i] ?? 0);

/** Строит позицию через `parse`, дополняя казаны так, чтобы всего было 162 шарика. */
export function position({
  white,
  black,
  whiteKazan,
  tuz = ['-', '-'],
  turn = 'w',
}: PositionInput): GameState {
  const pits = [...pad(white), ...pad(black)];
  const rest = TOTAL_KORGOOLS - pits.reduce((a, b) => a + b, 0);
  const kw = whiteKazan ?? Math.floor(rest / 2);
  return parse(`${pits.join(',')}/${kw},${rest - kw}/${tuz.join(',')}/${turn}`);
}

export const whiteRow = (s: GameState) => s.pits.slice(0, 9);
export const blackRow = (s: GameState) => s.pits.slice(9, 18);

import { BOARD_SIZE, PITS_PER_SIDE } from './constants';
import { EngineError, type Pit, type Side } from './types';

export function sideIndex(side: Side): 0 | 1 {
  return side === 'white' ? 0 : 1;
}

export function opponent(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

export function isValidPit(pit: number): boolean {
  return Number.isInteger(pit) && pit >= 1 && pit <= PITS_PER_SIDE;
}

/** Номер лунки игрока (1..9) → индекс на доске (0..17). */
export function pitToIndex(side: Side, pit: Pit): number {
  if (!isValidPit(pit)) throw new EngineError(`Неверный номер лунки: ${pit}`);
  return sideIndex(side) * PITS_PER_SIDE + pit - 1;
}

/** Индекс на доске (0..17) → чья лунка и её номер (1..9). */
export function indexToPit(index: number): { side: Side; pit: Pit } {
  if (!Number.isInteger(index) || index < 0 || index >= BOARD_SIZE) {
    throw new EngineError(`Неверный индекс лунки: ${index}`);
  }
  return {
    side: index < PITS_PER_SIDE ? 'white' : 'black',
    pit: (index % PITS_PER_SIDE) + 1,
  };
}

/** Индексы лунок игрока по порядку номеров 1..9. */
export function sideIndices(side: Side): number[] {
  const start = sideIndex(side) * PITS_PER_SIDE;
  return Array.from({ length: PITS_PER_SIDE }, (_, i) => start + i);
}

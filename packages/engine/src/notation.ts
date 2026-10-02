import { indexToPit, isValidPit, pitToIndex, sideIndices } from './board';
import { BOARD_SIZE, TOTAL_KORGOOLS } from './constants';
import { canCreateTuzdyk, statusByScore } from './game';
import { EngineError, type GameState, type MoveRecord, type Pit, type Side } from './types';

/**
 * Позиция → строка (rules.md §7):
 * `<18 чисел>/<казан Б>,<казан Ч>/<туздук Б>,<туздук Ч>/<w|b>`.
 * Туздук записывается номером лунки соперника (1..8) или `-`.
 */
export function serialize(state: GameState): string {
  const tuz = state.tuzdyks.map((i) => (i === null ? '-' : String(indexToPit(i).pit)));
  return [
    state.pits.join(','),
    state.kazans.join(','),
    tuz.join(','),
    state.turn === 'white' ? 'w' : 'b',
  ].join('/');
}

/** Строка → позиция. Бросает `EngineError`, если позиция некорректна. */
export function parse(str: string): GameState {
  const parts = str.trim().split('/');
  if (parts.length !== 4) throw new EngineError('Позиция должна состоять из 4 частей');
  const [pitsStr = '', kazansStr = '', tuzStr = '', turnStr = ''] = parts;

  const pits = parseCounts(pitsStr, BOARD_SIZE, 'лунок');
  const [kw = 0, kb = 0] = parseCounts(kazansStr, 2, 'казанов');
  const kazans: [number, number] = [kw, kb];

  const sum = pits.reduce((a, b) => a + b, 0) + kw + kb;
  if (sum !== TOTAL_KORGOOLS) {
    throw new EngineError(`В позиции ${sum} шариков, а должно быть ${TOTAL_KORGOOLS}`);
  }

  if (turnStr !== 'w' && turnStr !== 'b') throw new EngineError('Чей ход: ожидается w или b');
  const turn: Side = turnStr === 'w' ? 'white' : 'black';

  const tuzParts = tuzStr.split(',');
  if (tuzParts.length !== 2) throw new EngineError('Ожидается два туздука через запятую');
  const tuzdyks: [number | null, number | null] = [null, null];
  (['white', 'black'] as const).forEach((side, i) => {
    const raw = tuzParts[i];
    if (raw === '-') return;
    const pit = Number(raw);
    if (!isValidPit(pit)) throw new EngineError(`Неверный туздук: ${raw}`);
    const index = pitToIndex(side === 'white' ? 'black' : 'white', pit);
    if (!canCreateTuzdyk({ tuzdyks }, side, index)) {
      throw new EngineError(`Туздук ${raw} невозможен`);
    }
    if (pits[index] !== 0) throw new EngineError('В лунке-туздуке не может быть шариков');
    tuzdyks[i] = index;
  });

  const status = statusByScore(kazans);
  if (status === 'playing' && sideIndices(turn).every((i) => pits[i] === 0)) {
    throw new EngineError('У игрока, чей ход, нет ни одного хода');
  }

  return { pits, kazans, tuzdyks, turn, status };
}

function parseCounts(str: string, length: number, what: string): number[] {
  const values = str.split(',').map((s) => (/^\d+$/.test(s) ? Number(s) : NaN));
  if (values.length !== length || values.some(Number.isNaN)) {
    throw new EngineError(`Ожидается ${length} неотрицательных целых чисел для ${what}`);
  }
  return values;
}

/** Ход → нотация: `7`, `7x` (захват), `7X` (туздук). */
export function formatMove(record: Pick<MoveRecord, 'pit' | 'capture' | 'tuzdyk'>): string {
  return `${record.pit}${record.tuzdyk ? 'X' : record.capture ? 'x' : ''}`;
}

/** Партия → нотация: `1. 7x 3 2. 9X 5x`. */
export function formatGame(records: readonly MoveRecord[]): string {
  const out: string[] = [];
  records.forEach((record, i) => {
    if (i % 2 === 0) out.push(`${i / 2 + 1}.`);
    out.push(formatMove(record));
  });
  return out.join(' ');
}

/** Нотация партии → номера лунок (номера ходов и пометки x/X игнорируются). */
export function parseGame(str: string): Pit[] {
  return str
    .split(/\s+/)
    .filter((token) => token !== '' && !/^\d+\.$/.test(token))
    .map((token) => {
      const match = /^([1-9])[xX]?$/.exec(token);
      if (!match) throw new EngineError(`Неверный ход в нотации: ${token}`);
      return Number(match[1]);
    });
}

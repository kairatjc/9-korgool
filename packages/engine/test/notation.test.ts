import { describe, expect, it } from 'vitest';
import {
  EngineError,
  applyMove,
  formatGame,
  initialState,
  parse,
  parseGame,
  replay,
  serialize,
  type MoveRecord,
} from '../src';

const START = '9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9/0,0/-,-/w';

describe('serialize / parse', () => {
  it('стартовая позиция', () => {
    expect(serialize(initialState())).toBe(START);
    expect(parse(START)).toEqual(initialState());
  });

  it('туздук записывается номером лунки соперника', () => {
    const pits = [0, 0, 0, 0, 0, 0, 0, 1, 6, 0, 5, 9, 9, 9, 9, 9, 9, 9];
    const str = `${pits.join(',')}/12,75/1,-/b`;
    const s = parse(str);
    expect(s.tuzdyks).toEqual([9, null]);
    expect(serialize(s)).toBe(str);
  });

  it('roundtrip после нескольких ходов', () => {
    const s = replay([9, 1, 5, 3]);
    expect(parse(serialize(s))).toEqual(s);
  });

  it.each([
    ['не та длина', '9,9/0,0/-,-/w'],
    ['неверная сумма', START.replace('/0,0/', '/1,0/')],
    ['неверный ход', START.replace('/w', '/x')],
    ['туздук в 9-й лунке', START.replace('/-,-/', '/9,-/')],
    ['отрицательное число', START.replace('9,9/0', '9,-9/0')],
    ['туздуки с одинаковым номером', '9,0,9,9,9,9,9,9,9,9,0,9,9,9,9,9,9,9/9,9/2,2/w'],
  ])('ошибка: %s', (_, str) => {
    expect(() => parse(str)).toThrow(EngineError);
  });

  it('ошибка: в лунке-туздуке есть шарики', () => {
    expect(() => parse(START.replace('/-,-/', '/1,-/'))).toThrow(EngineError);
  });
});

describe('нотация партии', () => {
  it('formatGame нумерует пары ходов и ставит пометки', () => {
    const records: MoveRecord[] = [
      { side: 'white', pit: 7, capture: true, tuzdyk: false },
      { side: 'black', pit: 3, capture: false, tuzdyk: false },
      { side: 'white', pit: 9, capture: false, tuzdyk: true },
    ];
    expect(formatGame(records)).toBe('1. 7x 3 2. 9X');
  });

  it('parseGame извлекает номера лунок', () => {
    expect(parseGame('1. 7x 3  2. 9X 5x')).toEqual([7, 3, 9, 5]);
  });

  it('formatGame → parseGame → replay', () => {
    let s = initialState();
    const records: MoveRecord[] = [];
    for (const pit of [9, 2, 4, 8]) {
      const r = applyMove(s, pit);
      records.push(r.record);
      s = r.state;
    }
    expect(replay(parseGame(formatGame(records)))).toEqual(s);
  });

  it('ошибка в нотации', () => {
    expect(() => parseGame('1. 0')).toThrow(EngineError);
  });
});

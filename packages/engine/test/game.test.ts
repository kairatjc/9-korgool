import { describe, expect, it } from 'vitest';
import {
  EngineError,
  TOTAL_KORGOOLS,
  applyMove,
  initialState,
  legalMoves,
  pitToIndex,
  replay,
  type GameState,
} from '../src';
import { blackRow, position, whiteRow } from './helpers';

describe('начальная позиция', () => {
  it('по 9 шариков в 18 лунках, казаны пусты, ходят белые', () => {
    const s = initialState();
    expect(s.pits).toEqual(Array(18).fill(9));
    expect(s.kazans).toEqual([0, 0]);
    expect(s.tuzdyks).toEqual([null, null]);
    expect(s.turn).toBe('white');
    expect(s.status).toBe('playing');
  });

  it('доступны все 9 лунок', () => {
    expect(legalMoves(initialState())).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('посев', () => {
  it('первый шарик кладётся обратно в исходную лунку', () => {
    const { state } = applyMove(initialState(), 1);
    expect(whiteRow(state)).toEqual([1, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(blackRow(state)).toEqual(Array(9).fill(9));
    expect(state.turn).toBe('black');
  });

  it('одиночный шарик переходит в следующую лунку', () => {
    const s = position({ white: [1, 0, 0, 0, 0, 0, 0, 0, 0], black: [1, 1] });
    const { state } = applyMove(s, 1);
    expect(whiteRow(state)).toEqual([0, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('посев переходит с 9-й лунки на 1-ю лунку соперника', () => {
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 0, 3], black: [4, 4] });
    const { state } = applyMove(s, 9);
    expect(whiteRow(state)[8]).toBe(1);
    expect(blackRow(state).slice(0, 2)).toEqual([5, 5]);
  });

  it('у чёрных посев идёт с их 9-й лунки на 1-ю лунку белых', () => {
    const s = position({ white: [4, 1], black: [0, 0, 0, 0, 0, 0, 0, 0, 2], turn: 'b' });
    const { state } = applyMove(s, 9);
    expect(blackRow(state)[8]).toBe(1);
    expect(whiteRow(state)[0]).toBe(5);
  });

  it('большой посев проходит полный круг', () => {
    const s = position({ white: [20, 1], black: [1] });
    const { state } = applyMove(s, 1);
    // 20 шариков: лунки 0..17 получают по одному, затем 0 и 1 — ещё по одному.
    expect(state.pits[0]).toBe(2);
    expect(state.pits[1]).toBe(1 + 2);
    expect(state.pits[2]).toBe(1);
  });
});

describe('захват', () => {
  it('чётное число в лунке соперника после последнего шарика — захват', () => {
    // 9 шариков из 9-й лунки: 1 обратно, 8 в лунки чёрных 1..8; в 8-й становится 10.
    const { state, record, events } = applyMove(initialState(), 9);
    expect(record.capture).toBe(true);
    expect(state.kazans).toEqual([10, 0]);
    expect(blackRow(state)).toEqual([10, 10, 10, 10, 10, 10, 10, 0, 9]);
    expect(events).toContainEqual({ type: 'capture', index: 16, count: 10, by: 'white' });
  });

  it('нечётное число — захвата нет', () => {
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 0, 2], black: [4] });
    const { state, record } = applyMove(s, 9);
    expect(record.capture).toBe(false);
    expect(blackRow(state)[0]).toBe(5);
  });

  it('последний шарик в своей лунке — захвата нет, даже если там чётное', () => {
    const s = position({ white: [3, 1, 1], black: [1] });
    const { state, record } = applyMove(s, 1);
    expect(record.capture).toBe(false);
    expect(whiteRow(state).slice(0, 3)).toEqual([1, 2, 2]);
  });
});

describe('туздук', () => {
  it('ровно 3 в лунке соперника — туздук, шарики в казан', () => {
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 3, 5], black: [2, 5] });
    const { state, record, events } = applyMove(s, 8);
    expect(record.tuzdyk).toBe(true);
    expect(state.tuzdyks).toEqual([pitToIndex('black', 1), null]);
    expect(blackRow(state)[0]).toBe(0);
    expect(state.kazans[0]).toBe(s.kazans[0] + 3);
    expect(events).toContainEqual({ type: 'tuzdyk', index: 9, by: 'white' });
  });

  it('нельзя сделать туздуком 9-ю лунку соперника', () => {
    // 10 шариков из 9-й: 1 обратно, по одному в лунки чёрных 1..9; в 9-й становится 3.
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 0, 10], black: [1, 1, 1, 1, 1, 1, 1, 1, 2] });
    const { state, record } = applyMove(s, 9);
    expect(record.tuzdyk).toBe(false);
    expect(state.tuzdyks).toEqual([null, null]);
    expect(blackRow(state)[8]).toBe(3);
  });

  it('второй туздук создать нельзя', () => {
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 0, 3], black: [0, 2, 1], tuz: ['1', '-'] });
    const { state, record } = applyMove(s, 9);
    expect(record.tuzdyk).toBe(false);
    expect(state.tuzdyks).toEqual([pitToIndex('black', 1), null]);
    expect(blackRow(state)[1]).toBe(3);
  });

  it('нельзя сделать туздук с тем же номером, что у туздука соперника', () => {
    // У чёрных туздук в 1-й лунке белых → белые не могут объявить 1-ю лунку чёрных.
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 3, 5], black: [2, 5], tuz: ['-', '1'] });
    const { state, record } = applyMove(s, 8);
    expect(record.tuzdyk).toBe(false);
    expect(blackRow(state)[0]).toBe(3);
  });

  it('шарик, попавший в туздук, уходит в казан владельца', () => {
    // У чёрных туздук во 2-й лунке белых.
    const s = position({ white: [3, 0, 0], black: [1], tuz: ['-', '2'] });
    const before = s.kazans[1];
    const { state, events } = applyMove(s, 1);
    expect(whiteRow(state).slice(0, 3)).toEqual([1, 0, 1]);
    expect(state.kazans[1]).toBe(before + 1);
    expect(events).toContainEqual({ type: 'sow', index: 1, toKazan: 'black' });
  });

  it('последний шарик в туздуке — ни захвата, ни нового туздука', () => {
    // У белых туздук в 1-й лунке чёрных; белые сеют 2 из 9-й: 1 обратно, 1 в туздук.
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 0, 2], black: [0, 4], tuz: ['1', '-'] });
    const { state, record } = applyMove(s, 9);
    expect(record.capture).toBe(false);
    expect(state.kazans[0]).toBe(s.kazans[0] + 1);
  });
});

describe('конец партии', () => {
  it('82 шарика в казане — победа', () => {
    const s = position({ white: [0, 0, 0, 0, 0, 0, 0, 0, 2], black: [1, 5], whiteKazan: 80 });
    const { state, events } = applyMove(s, 9);
    expect(state.kazans[0]).toBe(82);
    expect(state.status).toBe('white_won');
    expect(events.at(-1)).toEqual({ type: 'game_over', status: 'white_won' });
    expect(legalMoves(state)).toEqual([]);
    expect(() => applyMove(state, 1)).toThrow(EngineError);
  });

  it('у соперника нет хода — сходивший забирает шарики со своей стороны; 81:81 — ничья', () => {
    const s = position({ white: [2], black: [], whiteKazan: 79 });
    const { state, events } = applyMove(s, 1);
    expect(events).toContainEqual({ type: 'collect', side: 'white', count: 2 });
    expect(state.kazans).toEqual([81, 81]);
    expect(state.status).toBe('draw');
    expect(state.pits.every((n) => n === 0)).toBe(true);
  });

  it('у соперника нет хода — побеждает тот, у кого больше', () => {
    const s = position({ white: [5], black: [], whiteKazan: 79 });
    const { state } = applyMove(s, 1);
    expect(state.kazans).toEqual([84, 78]);
    expect(state.status).toBe('white_won');
  });
});

describe('ошибки', () => {
  it('ход из пустой лунки', () => {
    const s = position({ white: [0, 1], black: [1] });
    expect(() => applyMove(s, 1)).toThrow(EngineError);
  });

  it.each([0, 10, 1.5, NaN])('неверный номер лунки %s', (pit) => {
    expect(() => applyMove(initialState(), pit)).toThrow(EngineError);
  });

  it('исходное состояние не изменяется', () => {
    const s = initialState();
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    applyMove(s, 5);
    expect(s).toEqual(copy);
  });
});

describe('случайные партии (инварианты)', () => {
  // Детерминированный ГПСЧ, чтобы тест был воспроизводимым.
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
  }

  const total = (s: GameState) => s.pits.reduce((a, b) => a + b, 0) + s.kazans[0] + s.kazans[1];

  it('300 партий: 162 шарика всегда, туздуки пусты, партия заканчивается', () => {
    const random = rng(42);
    const results = new Set<string>();
    for (let game = 0; game < 300; game++) {
      let s = initialState();
      let plies = 0;
      while (s.status === 'playing') {
        const moves = legalMoves(s);
        expect(moves.length).toBeGreaterThan(0);
        s = applyMove(s, moves[Math.floor(random() * moves.length)]!).state;
        expect(total(s)).toBe(TOTAL_KORGOOLS);
        for (const t of s.tuzdyks) if (t !== null) expect(s.pits[t]).toBe(0);
        expect(++plies).toBeLessThan(2000);
      }
      results.add(s.status);
    }
    expect(results.has('white_won') || results.has('black_won')).toBe(true);
  });

  it('replay воспроизводит партию', () => {
    expect(replay([9, 1]).turn).toBe('white');
    expect(replay([9]).kazans).toEqual([10, 0]);
  });
});

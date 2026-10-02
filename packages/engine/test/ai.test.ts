import { describe, expect, it } from 'vitest';
import {
  applyMove,
  chooseMove,
  initialState,
  isBotLevel,
  legalMoves,
  BOT_LEVELS,
  type BotLevel,
  type GameState,
} from '../src';
import { position } from './helpers';

/** Детерминированный генератор случайных чисел (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Белые: лунка 2 — тихий ход, лунка 9 — захват двух шариков в первой лунке Чёрных.
 * Ответного захвата у Чёрных нет ни после одного из ходов.
 */
const captureChoice = (whiteKazan?: number) =>
  position({
    white: [0, 1, 0, 0, 0, 0, 0, 0, 2],
    black: [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ...(whiteKazan === undefined ? {} : { whiteKazan }),
  });

/** Партия бота против бота; возвращает итоговую позицию. */
function play(white: BotLevel, black: BotLevel, random: () => number): GameState {
  let s = initialState();
  while (s.status === 'playing') {
    const pit = chooseMove(s, s.turn === 'white' ? white : black, { random });
    if (pit === null) throw new Error('нет хода в идущей партии');
    s = applyMove(s, pit).state;
  }
  return s;
}

describe('бот: общие свойства', () => {
  it('isBotLevel принимает только уровни 1..4', () => {
    expect(BOT_LEVELS.every(isBotLevel)).toBe(true);
    expect([0, 5, 2.5, '2', null].some(isBotLevel)).toBe(false);
  });

  it('в окончённой партии хода нет', () => {
    const over = { ...initialState(), status: 'white_won' as const };
    for (const level of BOT_LEVELS) expect(chooseMove(over, level)).toBeNull();
  });

  it('любой уровень выбирает допустимый ход', () => {
    const random = seeded(1);
    let s = initialState();
    for (let i = 0; i < 12 && s.status === 'playing'; i++) {
      for (const level of BOT_LEVELS) {
        expect(legalMoves(s)).toContain(chooseMove(s, level, { random }));
      }
      s = applyMove(s, chooseMove(s, 1, { random }) ?? 0).state;
    }
  });

  it('при одинаковом random ход воспроизводим', () => {
    const s = applyMove(initialState(), 5).state;
    for (const level of BOT_LEVELS) {
      expect(chooseMove(s, level, { random: seeded(7) })).toBe(
        chooseMove(s, level, { random: seeded(7) }),
      );
    }
  });
});

describe('бот: уровни', () => {
  it('уровень 1 играет случайно, но захваты выбирает чаще', () => {
    const s = captureChoice();
    const random = seeded(42);
    let captures = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) if (chooseMove(s, 1, { random }) === 9) captures++;
    // Вес захвата 3 против 1 → ожидаем около 75 %.
    expect(captures / n).toBeGreaterThan(0.65);
    expect(captures / n).toBeLessThan(0.85);
  });

  it('уровни 2–4 берут шарики, когда это выгодно', () => {
    for (const level of [2, 3, 4] as const) expect(chooseMove(captureChoice(), level)).toBe(9);
  });

  it('уровни 2–4 выигрывают партию одним ходом, если могут', () => {
    const s = captureChoice(80);
    expect(applyMove(s, 9).state.status).toBe('white_won');
    for (const level of [2, 3, 4] as const) expect(chooseMove(s, level)).toBe(9);
  });

  it('уровень 2 сильнее уровня 1', () => {
    const random = seeded(3);
    let wins = 0;
    for (let g = 0; g < 4; g++) {
      const twoIsWhite = g % 2 === 0;
      const end = twoIsWhite ? play(2, 1, random) : play(1, 2, random);
      if (end.status === (twoIsWhite ? 'white_won' : 'black_won')) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  });

  it('уровень 3 сильнее уровня 2', () => {
    const random = seeded(5);
    let wins = 0;
    for (let g = 0; g < 2; g++) {
      const threeIsWhite = g % 2 === 0;
      const end = threeIsWhite ? play(3, 2, random) : play(2, 3, random);
      if (end.status === (threeIsWhite ? 'white_won' : 'black_won')) wins++;
    }
    expect(wins).toBe(2);
  }, 30_000);
});

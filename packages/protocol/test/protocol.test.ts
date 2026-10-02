import { describe, expect, it } from 'vitest';
import {
  createGameSchema,
  gameIdSchema,
  moveSchema,
  TIME_CONTROL_PRESETS,
  timeControlSchema,
} from '../src';

describe('код партии', () => {
  it('приводится к верхнему регистру', () => {
    expect(gameIdSchema.parse(' ab23cd ')).toBe('AB23CD');
  });

  it('без похожих символов 0/O и 1/I', () => {
    expect(gameIdSchema.safeParse('AB10CD').success).toBe(false);
    expect(gameIdSchema.safeParse('ABCDE').success).toBe(false);
  });
});

describe('контроль времени', () => {
  it('все пресеты проходят проверку', () => {
    for (const tc of Object.values(TIME_CONTROL_PRESETS)) {
      expect(timeControlSchema.parse(tc)).toEqual(tc);
    }
  });

  it('без часов — null', () => {
    expect(createGameSchema.parse({ timeControl: null, color: 'random' })).toEqual({
      timeControl: null,
      color: 'random',
    });
  });
});

describe('ход', () => {
  it('лунка 1..9 и неотрицательный номер полухода', () => {
    expect(moveSchema.safeParse({ gameId: 'AB23CD', pit: 9, ply: 0 }).success).toBe(true);
    expect(moveSchema.safeParse({ gameId: 'AB23CD', pit: 0, ply: 0 }).success).toBe(false);
    expect(moveSchema.safeParse({ gameId: 'AB23CD', pit: 3, ply: -1 }).success).toBe(false);
  });
});

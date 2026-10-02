/* Fixture data from design/handoff/app.js and board.js (FIXTURES, DATA). Not UI copy.
   Used by the dev-only /__design route and by tests; positions are parsed by the real engine. */
import { parse, type GameState, type MoveEvent } from '@korgool/engine';
import type { DiagramData } from '../board/Diagram';
import type { Person } from '../components/ui';

export const FIXTURES = {
  start: '9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9/0,0/-,-/w',
  midgame: '5,0,11,2,1,0,23,1,4,7,3,0,0,14,2,9,1,6/40,33/3,6/w',
  endgame: '0,0,1,0,2,0,0,3,0,1,0,0,0,0,0,2,0,0/78,75/4,7/w',
  gameover: '0,2,0,1,0,0,4,0,3,0,1,0,0,5,0,0,2,0/84,60/-,-/w',
} as const;

export type FixtureId = keyof typeof FIXTURES;
export const isFixture = (v: unknown): v is FixtureId => typeof v === 'string' && v in FIXTURES;

export function fixture(id: FixtureId): GameState {
  return parse(FIXTURES[id]);
}

export type MovePair = [string, string?];

export interface HistoryEntry extends Person {
  result: 'win' | 'loss' | 'draw';
  score: string;
  date: string;
}

export const DATA = {
  me: { name: 'Айбек', initial: 'А', place: 'Бишкек, Кыргызстан' },
  opponent: { name: 'Бүркүт_42', initial: 'Б' } satisfies Person,
  bot: { name: 'Устат (бот)', icon: 'bot' } satisfies Person,
  clocks: { me: '3:47', opponent: '4:12', low: '0:14' },
  time: { online: '5+3', friend: '10+5' },
  roomCode: 'K7M2QX',
  inviteLink: 'toguz.kg/r/K7M2QX',
  joinPrefill: 'K7M',
  moves: [
    ['7', '3'],
    ['9x', '5'],
    ['3', '7x'],
    ['1', '2'],
    ['8x', '9X'],
    ['6', '4x'],
    ['2X', '1'],
    ['5', '8'],
    ['4x', '3x'],
    ['9', '6'],
    ['7x', '2'],
    ['3', '5'],
  ] as MovePair[],
  stats: { wins: 48, losses: 31, draws: 4, tuzdyks: 37 },
  history: [
    { name: 'Бүркүт_42', initial: 'Б', result: 'win', score: '84 : 78', date: '28.09.2026' },
    { name: 'Устат (бот)', icon: 'bot', result: 'loss', score: '71 : 91', date: '27.09.2026' },
    { name: 'Асель_kg', initial: 'А', result: 'win', score: '82 : 67', date: '25.09.2026' },
    { name: 'Талант', initial: 'Т', result: 'draw', score: '81 : 81', date: '24.09.2026' },
    { name: 'nurlan.b', initial: 'N', result: 'loss', score: '66 : 96', date: '21.09.2026' },
    { name: 'Бүркүт_42', initial: 'Б', result: 'win', score: '90 : 72', date: '19.09.2026' },
  ] as HistoryEntry[],
  /** Last move on `midgame`: opponent pit 5 (index 13) → my pit 3 (index 2). */
  midgameHighlight: { lastFrom: 13, lastTo: 2 },
  /** Event list from the brief: start position, White plays pit 9. */
  demoEvents: [
    { type: 'pickup', index: 8, count: 9 },
    { type: 'sow', index: 8, toKazan: null },
    { type: 'sow', index: 9, toKazan: null },
    { type: 'sow', index: 10, toKazan: null },
    { type: 'sow', index: 11, toKazan: null },
    { type: 'sow', index: 12, toKazan: null },
    { type: 'sow', index: 13, toKazan: null },
    { type: 'sow', index: 14, toKazan: null },
    { type: 'sow', index: 15, toKazan: null },
    { type: 'sow', index: 16, toKazan: null },
    { type: 'capture', index: 16, count: 10, by: 'white' },
  ] as MoveEvent[],
};

/** Rules diagrams; label values are i18n keys. */
export const DIAGRAMS: Record<'sow' | 'capture' | 'tuzdyk', DiagramData> = {
  sow: {
    bottom: [9, 9, 1, 10, 10],
    top: [9, 9, 9, 9, 7],
    states: { b2: 'from', t4: 'to' },
    arrow: ['b2', 't4'],
  },
  capture: {
    bottom: [9, 9, 9, 9, 1],
    top: [9, 9, 9, 6, 8],
    states: { b4: 'from', t3: 'capture' },
    arrow: ['b4', 't3'],
    labels: { t3: 'rules.labelCapture' },
  },
  tuzdyk: {
    bottom: [9, 9, 9, 1, 10],
    top: [9, 9, 9, 9, 3],
    states: { b3: 'from', t4: 'tuzdyk-mine' },
    arrow: ['b3', 't4'],
    labels: { t4: 'game.tuzdyk' },
  },
};

/* Strings are the handoff's copy.json with the same keys; every difference must be listed here
   and in design/DEVIATIONS.md. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from './en.json';
import ky from './ky.json';
import ru from './ru.json';

type Copy = Record<string, Record<'ru' | 'ky' | 'en', string | undefined>>;
const copy = JSON.parse(
  readFileSync(new URL('../../../../design/handoff/copy.json', import.meta.url), 'utf8'),
) as Copy;
const langs = { ru, ky, en } as Record<'ru' | 'ky' | 'en', Record<string, string>>;

/** Agreed copy changes: the pit is called «уя» (not «отау»). */
const DEVIATIONS: Record<string, Partial<Record<'ru' | 'ky' | 'en', string>>> = {
  'rules.boardText': {
    ru: 'У каждого игрока 9 лунок — уя — и казан для выигранных шариков. В начале в каждой лунке по 9 шариков, всего 162.',
    en: 'Each player has 9 pits (uya) and a kazan for captured korgools. Every pit starts with 9 korgools, 162 in total.',
  },
};

/** Strings the handoff does not have: online play (server errors, draw offers, cancelled games) and the
    tutorial steps the handoff did not draw (only step 2 is designed). */
const ADDED = [
  'online.notFound',
  'online.full',
  'online.error',
  'game.drawOfferTitle',
  'game.drawAccept',
  'game.drawDecline',
  'over.cancelled',
  'over.reason.cancelled',
  'over.reason.agreed',
  'tutorial.next',
  'tutorial.playBot',
  'tutorial.boardTitle',
  'tutorial.boardText',
  'tutorial.sowDone',
  'tutorial.captureTitle',
  'tutorial.captureText',
  'tutorial.captureDone',
  'tutorial.tuzdykTitle',
  'tutorial.tuzdykText',
  'tutorial.tuzdykDone',
  'tutorial.winTitle',
  'tutorial.winText',
  'tutorial.winDone',
];

describe('i18n', () => {
  for (const lang of ['ru', 'ky', 'en'] as const) {
    it(`${lang} has exactly the handoff keys and strings`, () => {
      expect(Object.keys(langs[lang]).sort()).toEqual([...Object.keys(copy), ...ADDED].sort());
      for (const key of ADDED) expect(langs[lang][key], key).toBeTruthy();
      for (const [key, entry] of Object.entries(copy)) {
        const expected = DEVIATIONS[key]?.[lang] ?? entry[lang] ?? entry.ru;
        expect(langs[lang][key], key).toBe(expected);
      }
    });
  }
});

/* The React board must produce the same SVG as the handoff's own renderer (design/handoff/board.js),
   and the engine must emit the same move events the handoff's motion expects. */
import { applyMove, legalMoves, parse, type GameState } from '@korgool/engine';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../game/fixtures';
import { Board, type BoardOptions } from './Board';
import { Diagram, KazanSample, PitSample, type DiagramData } from './Diagram';
import { ballPositions, GEO, kazanSlot, pitGeom } from './geometry';

interface HandoffTK {
  FIXTURES: Record<string, string>;
  parseFixture(s: string): GameState;
  renderBoard(st: GameState, o: object): string;
  renderDiagram(d: DiagramData): string;
  renderPitSample(o: object): string;
  renderKazanSample(o: object): string;
  ballPositions(count: number, slot: object): unknown;
  pitGeom(L: string, i: number, me: string): unknown;
  kazanSlot(L: string, side: number, me: string, n: number): unknown;
  computeMove(st: GameState, idx: number): { events: unknown[] };
}
// board.js is a classic script that exports through `module.exports`; run it as such.
const TK = (() => {
  const sandbox = { module: { exports: {} as unknown } };
  runInNewContext(
    readFileSync(new URL('../../../../design/handoff/board.js', import.meta.url), 'utf8'),
    sandbox,
  );
  return sandbox.module.exports as HandoffTK;
})();

/** Canonical form of an SVG string: attributes sorted, self-closing tags expanded. */
function normalize(svg: string): string {
  return svg
    .replace(/<([a-zA-Z]+)([^>]*?)(\/?)>/g, (_, tag: string, attrs: string, selfClose: string) => {
      const list = [...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)]
        .map((m) => `${m[1]}="${m[2]}"`)
        .sort();
      return `<${tag}${list.length ? ' ' + list.join(' ') : ''}>${selfClose ? `</${tag}>` : ''}`;
    })
    .replace(/&quot;/g, '"');
}

const CASES: [string, BoardOptions][] = [
  ['h', { layout: 'h' }],
  ['v', { layout: 'v' }],
  ['h black', { layout: 'h', me: 'black' }],
  ['v black', { layout: 'v', me: 'black' }],
  ['static', { layout: 'h', interactive: false, uid: 'home' }],
  [
    'states',
    {
      layout: 'v',
      lastFrom: 13,
      lastTo: 2,
      capture: 16,
      hint: 6,
      hover: 6,
      pressed: 4,
      previewTarget: 10,
      previewLabel: '+10',
      pitClass: { 3: 'k-pit--bump' },
    },
  ],
  ['legalOnly', { layout: 'h', legalOnly: [6], hint: 6, uid: 'tut' }],
];

describe('Board matches handoff renderBoard', () => {
  for (const [fx, str] of Object.entries(FIXTURES)) {
    for (const [name, o] of CASES) {
      it(`${fx} · ${name}`, () => {
        const ours = renderToStaticMarkup(<Board state={parse(str)} {...o} />);
        const theirs = TK.renderBoard(TK.parseFixture(str), o);
        expect(normalize(ours)).toBe(normalize(theirs));
      });
    }
  }
});

describe('diagrams and samples match the handoff', () => {
  const d: DiagramData = {
    bottom: [9, 9, 9, 9, 1],
    top: [9, 9, 9, 6, 8],
    states: { b4: 'from', t3: 'capture' },
    arrow: ['b4', 't3'],
    labels: { t3: '+6' },
  };
  it('rules diagram', () => {
    expect(normalize(renderToStaticMarkup(<Diagram d={d} />))).toBe(normalize(TK.renderDiagram(d)));
  });
  it('pit samples', () => {
    for (const o of [
      { count: 9 },
      { count: 40 },
      { count: 0, cls: ['k-pit--tuzdyk-mine'], side: 'opponent' as const },
      { count: 9, cls: ['k-pit--preview-target'], side: 'opponent' as const, label: '+10' },
    ]) {
      expect(normalize(renderToStaticMarkup(<PitSample {...o} />))).toBe(
        normalize(TK.renderPitSample({ layout: 'h', ...o })),
      );
    }
  });
  it('kazan samples', () => {
    for (const count of [0, 9, 40, 100, 162]) {
      expect(normalize(renderToStaticMarkup(<KazanSample count={count} />))).toBe(
        normalize(TK.renderKazanSample({ layout: 'h', count })),
      );
    }
  });
});

describe('geometry is the handoff geometry', () => {
  it('pit and kazan slots', () => {
    for (const L of ['h', 'v'] as const)
      for (const me of ['white', 'black'] as const)
        for (let i = 0; i < 18; i++) expect(pitGeom(L, i, me)).toEqual(TK.pitGeom(L, i, me));
    for (const L of ['h', 'v'] as const)
      for (const n of [0, 1, 50, 99, 150])
        expect(kazanSlot(L, 1, 'white', n)).toEqual(TK.kazanSlot(L, 1, 'white', n));
  });
  it('ball positions', () => {
    for (const L of ['h', 'v'] as const)
      for (let n = 0; n <= 40; n++) {
        const slot = { kind: 'pit' as const, cx: 100, cy: 100, ...GEO[L].pit, r: GEO[L].ballR };
        expect(ballPositions(n, slot)).toEqual(TK.ballPositions(n, slot));
      }
  });
});

describe('engine events match the handoff motion format', () => {
  it('every legal move of every fixture', () => {
    for (const str of Object.values(FIXTURES)) {
      const st = parse(str);
      if (st.status !== 'playing') continue;
      for (const pit of legalMoves(st)) {
        const idx = (st.turn === 'white' ? 0 : 9) + pit - 1;
        const ours = applyMove(st, pit).events.filter(
          (e) => e.type !== 'collect' && e.type !== 'game_over',
        );
        expect(ours).toEqual(
          TK.computeMove(
            TK.parseFixture(str.replace(/\/w$/, st.turn === 'white' ? '/w' : '/b')),
            idx,
          ).events,
        );
      }
    }
  });
});

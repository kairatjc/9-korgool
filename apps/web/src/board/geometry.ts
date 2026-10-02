/* Board geometry — ported 1:1 from design/handoff/board.js (GEO, pitGeom, ballPositions, kazanSlot).
   All numbers are SVG user units inside the board viewBox; see design/handoff/board-spec.md. */
import type { Side } from '@korgool/engine';

export type Layout = 'h' | 'v';

/** Up to 14 balls drawn individually in a pit, more → heap. */
export const PIT_N = 14;
/** Up to 100 balls drawn in a kazan, more → full kazan, the number shows the rest. */
export const KAZAN_N = 100;

export interface KazanBox {
  x: number;
  y: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  from: 'start' | 'end';
}

export interface LayoutGeo {
  w: number;
  h: number;
  radius: number;
  inlayInset: number;
  pit: { rx: number; ry: number };
  ring: number;
  ballR: number;
  pill: { w: number; h: number };
  preview: { h: number; charW: number; pad: number };
  kazan: { mine: KazanBox; opp: KazanBox };
  kBallR: number;
  badgeR: number;
  medal: { x: number; y: number; r: number };
  seam: string;
  mineHalf: string;
}

const SEAM_H = 'M0 294 H480 Q500 294 500 274 V206 Q500 186 520 186 H1000';
const SEAM_V = 'M240 0 V300 Q240 320 220 320 H160 Q140 320 140 340 V640';

export const GEO: Record<Layout, LayoutGeo> = {
  h: {
    w: 1000,
    h: 480,
    radius: 28,
    inlayInset: 9,
    pit: { rx: 44, ry: 54 },
    ring: 5,
    ballR: 8.5,
    pill: { w: 40, h: 24 },
    preview: { h: 26, charW: 9, pad: 14 },
    kazan: {
      mine: { x: 524, y: 192, w: 440, h: 96, axis: 'x', from: 'end' },
      opp: { x: 36, y: 192, w: 440, h: 96, axis: 'x', from: 'start' },
    },
    kBallR: 7.5,
    badgeR: 24,
    medal: { x: 500, y: 240, r: 20 },
    seam: SEAM_H,
    mineHalf: SEAM_H + ' V480 H0 Z',
  },
  v: {
    w: 380,
    h: 640,
    radius: 26,
    inlayInset: 9,
    pit: { rx: 40, ry: 31 },
    ring: 5,
    ballR: 6,
    pill: { w: 30, h: 20 },
    preview: { h: 22, charW: 7.5, pad: 10 },
    kazan: {
      mine: { x: 144, y: 336, w: 92, h: 290, axis: 'y', from: 'end' },
      opp: { x: 144, y: 14, w: 92, h: 290, axis: 'y', from: 'start' },
    },
    kBallR: 6,
    badgeR: 18,
    medal: { x: 190, y: 320, r: 12 },
    seam: SEAM_V,
    mineHalf: SEAM_V + ' H380 V0 Z',
  },
};

export interface Point {
  x: number;
  y: number;
}

export interface PitGeom {
  mine: boolean;
  /** 0..8 — pit number − 1. */
  p: number;
  cx: number;
  cy: number;
  pill: Point;
  num: Point;
  hit: { x: number; y: number; w: number; h: number };
}

export const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Slot geometry for board index i (0..17) seen by player `me`.
    My row: bottom (h) / right column, pit 1 at the bottom (v). Sowing runs counter-clockwise. */
export function pitGeom(L: Layout, i: number, me: Side): PitGeom {
  const mine = i < 9 === (me !== 'black');
  const p = i % 9;
  if (L === 'h') {
    const col = mine ? p : 8 - p;
    const x = 76 + col * 106;
    return {
      mine,
      p,
      cx: x,
      cy: mine ? 384 : 96,
      pill: { x, y: mine ? 312 : 168 },
      num: { x, y: mine ? 462 : 22 },
      hit: { x: x - 53, y: mine ? 300 : 0, w: 106, h: 180 },
    };
  }
  const row = mine ? 8 - p : p;
  const y = 44 + row * 69;
  return {
    mine,
    p,
    cx: mine ? 316 : 64,
    cy: y,
    pill: { x: mine ? 259 : 121, y },
    num: { x: mine ? 370 : 10, y },
    hit: { x: mine ? 244 : 0, y: y - 34.5, w: 136, h: 69 },
  };
}

export function pitCenter(L: Layout, i: number, me: Side): Point {
  const g = pitGeom(L, i, me);
  return { x: g.cx, y: g.cy };
}

/** side: 0 white, 1 black. */
export function kazanGeom(L: Layout, side: 0 | 1, me: Side): KazanBox {
  const mineSide = me === 'black' ? 1 : 0;
  return GEO[L].kazan[side === mineSide ? 'mine' : 'opp'];
}

/* ── Ball layout ──────────────────────────────── */
const latticeCache = new Map<string, Point[]>();
/** The lattice depends only on the pit shape; cached (the handoff recomputes it on every render). */
function pitLattice(rx: number, ry: number, r: number): Point[] {
  const key = `${rx},${ry},${r}`;
  let pts = latticeCache.get(key);
  if (!pts) latticeCache.set(key, (pts = buildLattice(rx, ry, r)));
  return pts;
}

function buildLattice(rx: number, ry: number, r: number): Point[] {
  const s = 2 * r + 1,
    ax = rx - r - 1,
    ay = ry - r - 1,
    pts: Point[] = [];
  const rows = Math.ceil(ay / (s * 0.866)) + 1,
    cols = Math.ceil(ax / s) + 1;
  for (let j = -rows; j <= rows; j++) {
    const y = j * s * 0.866,
      off = Math.abs(j) % 2 ? 0.5 : 0;
    for (let i = -cols; i <= cols; i++) {
      const x = (i + off) * s;
      if ((x * x) / (ax * ax) + (y * y) / (ay * ay) <= 1.0001) pts.push({ x, y });
    }
  }
  const d = (p: Point) => Math.round(((p.x * p.x) / (rx * rx) + (p.y * p.y) / (ry * ry)) * 1e6);
  const ang = (p: Point) => Math.round(Math.atan2(p.y, p.x) * 1e6);
  pts.sort((a, b) => d(a) - d(b) || ang(a) - ang(b));
  return pts;
}

export type BallSlot =
  | { kind: 'pit'; cx: number; cy: number; rx: number; ry: number; r: number }
  | ({ kind: 'kazan'; r: number; badge: number } & KazanBox);

export interface BallPos extends Point {
  /** 1 = second layer of a heap. */
  layer: 0 | 1;
}

export function ballPositions(count: number, slot: BallSlot): BallPos[] {
  if (count <= 0) return [];
  if (slot.kind === 'pit') {
    const lat = pitLattice(slot.rx, slot.ry, slot.r);
    if (count <= PIT_N) {
      const sel = lat.slice(0, count);
      let mx = 0,
        my = 0;
      sel.forEach((p) => {
        mx += p.x;
        my += p.y;
      });
      mx /= count;
      my /= count;
      return sel.map((p) => ({ x: r2(slot.cx + p.x - mx), y: r2(slot.cy + p.y - my), layer: 0 }));
    }
    const s = 2 * slot.r + 1;
    const base: BallPos[] = lat.map((p) => ({
      x: r2(slot.cx + p.x),
      y: r2(slot.cy + p.y),
      layer: 0,
    }));
    const top: BallPos[] = lat
      .map((p) => ({ x: p.x + s / 2, y: p.y + s * 0.289 }))
      .filter((p) => (p.x * p.x) / (slot.rx * 0.62) ** 2 + (p.y * p.y) / (slot.ry * 0.62) ** 2 <= 1)
      .slice(0, 7)
      .map((p) => ({ x: r2(slot.cx + p.x), y: r2(slot.cy + p.y), layer: 1 }));
    return base.concat(top);
  }
  const { x, y, w, h, r, axis, from, badge } = slot;
  const s = 2 * r + 1,
    pad = r + 4;
  const long = axis === 'x' ? w : h,
    cross = axis === 'x' ? h : w,
    half = cross / 2 - pad;
  const out: BallPos[] = [],
    n = Math.min(count, KAZAN_N);
  for (
    let a = badge + pad, c = 0;
    a <= long - pad - cross * 0.22 && out.length < n;
    a += s * 0.866, c++
  ) {
    const off = c % 2 ? 0.5 : 0,
      k0 = Math.floor(half / s) + 1;
    for (let k = -k0; k <= k0 && out.length < n; k++) {
      const b = (k + off) * s;
      if (Math.abs(b) > half + 0.001) continue;
      const al = from === 'start' ? a : long - a;
      out.push(
        axis === 'x'
          ? { x: r2(x + al), y: r2(y + h / 2 + b), layer: 0 }
          : { x: r2(x + w / 2 + b), y: r2(y + al), layer: 0 },
      );
    }
  }
  return out;
}

export const kazanBadge = (L: Layout): number => GEO[L].badgeR * 2 + 8;

/** Where the n-th ball (0-based) of a kazan sits — used by motion as a landing point. */
export function kazanSlot(L: Layout, side: 0 | 1, me: Side, n: number): Point {
  const k = kazanGeom(L, side, me);
  const pos = ballPositions(Math.min(n, KAZAN_N - 1) + 1, {
    kind: 'kazan',
    r: GEO[L].kBallR,
    badge: kazanBadge(L),
    ...k,
  });
  return pos[pos.length - 1] ?? { x: k.x + k.w / 2, y: k.y + k.h / 2 };
}

/** Width of a preview badge («+N» / «туздук») for the given label. */
export function previewWidth(L: Layout, label: string): number {
  const V = GEO[L].preview;
  return label ? String(label).length * V.charW + V.pad * 2 : 0;
}

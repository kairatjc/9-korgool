/* Move playback — port of design/handoff/motion.js.
   Plays the engine's MoveEvent[] on a board. All timings/easings are read from tokens.css and multiplied
   by the speed factor (--speed-slow | normal | fast | off). The board is re-rendered from state after each
   landing (via `render`, which must commit synchronously); flying balls live in the FX layer. */
import type { GameStatus, MoveEvent, Side } from '@korgool/engine';
import type { BoardState } from './Board';
import { kazanSlot, pitCenter, type Layout, type Point } from './geometry';

const NS = 'http://www.w3.org/2000/svg';
const css = () => getComputedStyle(document.documentElement);
const ms = (name: string): number => {
  const v = css().getPropertyValue(name).trim();
  return v.endsWith('ms')
    ? parseFloat(v)
    : v.endsWith('s')
      ? parseFloat(v) * 1000
      : parseFloat(v) || 0;
};
const num = (name: string): number => parseFloat(css().getPropertyValue(name)) || 0;
const str = (name: string): string => css().getPropertyValue(name).trim();
const sleep = (t: number) => new Promise<void>((r) => setTimeout(r, t));

export type Speed = 'slow' | 'normal' | 'fast' | 'off';
export const SPEEDS: readonly Speed[] = ['slow', 'normal', 'fast', 'off'];
const SPEED_TOKEN: Record<Speed, string> = {
  slow: '--speed-slow',
  normal: '--speed-normal',
  fast: '--speed-fast',
  off: '--speed-off',
};

export interface Highlight {
  lastFrom: number | null;
  lastTo: number | null;
}

export interface MutableBoardState {
  pits: number[];
  kazans: [number, number];
  tuzdyks: [number | null, number | null];
  turn: Side;
}

export function cloneState(s: BoardState): MutableBoardState {
  return {
    pits: s.pits.slice(),
    kazans: [s.kazans[0], s.kazans[1]],
    tuzdyks: [s.tuzdyks[0], s.tuzdyks[1]],
    turn: s.turn,
  };
}

/** One frame of playback: what the board should show right now. */
export interface MotionFrame {
  state: MutableBoardState;
  hl: Highlight;
  capture?: number;
  pitClass?: Record<number, string>;
  kazanClass?: Partial<Record<Side, string>>;
}

export interface PlayOptions {
  layout: Layout;
  me: Side;
  speed: Speed;
  /** Show a frame. Must commit to the DOM synchronously (use `flushSync`). */
  render: (frame: MotionFrame) => void;
  /** The FX layer of the mounted board. */
  fx: () => SVGSVGElement | null;
  onGameOver?: (status: Exclude<GameStatus, 'playing'>) => void;
  /** Return true to stop playback (e.g. the screen unmounted). */
  cancelled?: () => boolean;
}

/** One ball flying along a quadratic arc (control point lifted by --motion-arc-lift × distance, capped by --motion-arc-max). */
export function fly(
  fx: SVGSVGElement | null,
  from: Point,
  to: Point,
  r: number,
  duration: number,
  easing: string,
  delay = 0,
): Promise<void> {
  if (!fx) return Promise.resolve();
  const u = document.createElementNS(NS, 'use');
  u.setAttribute('href', '#k-ball');
  u.setAttribute('class', 'k-ball k-ball--flying');
  fx.appendChild(u);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.min(num('--motion-arc-max'), dist * num('--motion-arc-lift'));
  const c = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift };
  const frames: Keyframe[] = [];
  for (let k = 0; k <= 12; k++) {
    const t = k / 12,
      a = (1 - t) * (1 - t),
      b = 2 * (1 - t) * t,
      d = t * t;
    frames.push({
      transform: `translate(${a * from.x + b * c.x + d * to.x}px, ${a * from.y + b * c.y + d * to.y}px) scale(${r})`,
    });
  }
  u.style.transform = String(frames[0]?.transform ?? '');
  const anim = u.animate(frames, { duration, easing, delay, fill: 'both' });
  return anim.finished.then(
    () => u.remove(),
    () => u.remove(),
  );
}

const sideI = (s: Side): 0 | 1 => (s === 'black' ? 1 : 0);

export function applyInstant(st: MutableBoardState, ev: MoveEvent): void {
  switch (ev.type) {
    case 'pickup':
      st.pits[ev.index] = 0;
      break;
    case 'sow':
      if (ev.toKazan) st.kazans[sideI(ev.toKazan)]++;
      else st.pits[ev.index] = (st.pits[ev.index] ?? 0) + 1;
      break;
    case 'capture':
      st.pits[ev.index] = 0;
      st.kazans[sideI(ev.by)] += ev.count;
      break;
    case 'tuzdyk':
      st.tuzdyks[sideI(ev.by)] = ev.index;
      st.kazans[sideI(ev.by)] += st.pits[ev.index] ?? 0;
      st.pits[ev.index] = 0;
      break;
    case 'collect': {
      const s = sideI(ev.side);
      for (let i = s * 9; i < s * 9 + 9; i++) {
        st.kazans[s] += st.pits[i] ?? 0;
        st.pits[i] = 0;
      }
      break;
    }
    case 'game_over':
      break;
  }
}

/** Plays `events` starting from `start`. Resolves with the final board and the last-move highlight. */
export async function playMove(
  start: BoardState,
  events: readonly MoveEvent[],
  o: PlayOptions,
): Promise<{ state: MutableBoardState; hl: Highlight }> {
  const L = o.layout,
    me = o.me;
  const k = num(SPEED_TOKEN[o.speed]);
  const st = cloneState(start),
    hl: Highlight = { lastFrom: null, lastTo: null };
  const snapshot = (): MutableBoardState => cloneState(st);
  const render = (extra: Omit<MotionFrame, 'state' | 'hl'> = {}) =>
    o.render({ state: snapshot(), hl: { ...hl }, ...extra });
  const T = (name: string) => ms(name) * k;
  const ballR = () => Number(o.fx()?.dataset.ballR ?? 0);
  const kBallR = () => Number(o.fx()?.dataset.kazanBallR ?? 0);
  const cap = num('--motion-flight-cap');
  const stop = () => o.cancelled?.() === true;

  if (k === 0) {
    events.forEach((ev) => {
      applyInstant(st, ev);
      if (ev.type === 'pickup') hl.lastFrom = ev.index;
      if (ev.type === 'sow' && !ev.toKazan) hl.lastTo = ev.index;
      if (ev.type === 'game_over') o.onGameOver?.(ev.status);
    });
    render();
    return { state: st, hl };
  }

  render();
  let hand: Point | null = null;
  for (const ev of events) {
    if (stop()) break;
    if (ev.type === 'pickup') {
      hl.lastFrom = ev.index;
      render({ pitClass: { [ev.index]: 'k-pit--lifting' } });
      await sleep(T('--duration-pickup'));
      st.pits[ev.index] = 0;
      render();
      hand = pitCenter(L, ev.index, me);
    } else if (ev.type === 'sow') {
      const to = pitCenter(L, ev.index, me);
      await fly(o.fx(), hand ?? to, to, ballR(), T('--duration-sow-flight'), str('--ease-sow'));
      if (ev.toKazan) {
        const s = sideI(ev.toKazan);
        await fly(
          o.fx(),
          to,
          kazanSlot(L, s, me, st.kazans[s]),
          kBallR(),
          T('--duration-sow-flight'),
          str('--ease-sow'),
        );
        st.kazans[s]++;
        render({ kazanClass: { [ev.toKazan]: 'k-kazan--bump' } });
      } else {
        st.pits[ev.index] = (st.pits[ev.index] ?? 0) + 1;
        hl.lastTo = ev.index;
        render({ pitClass: { [ev.index]: 'k-pit--bump' } });
      }
      hand = to;
      await sleep(T('--delay-sow-step'));
    } else if (ev.type === 'capture' || ev.type === 'tuzdyk') {
      const s = sideI(ev.by),
        count = ev.type === 'capture' ? ev.count : (st.pits[ev.index] ?? 0);
      if (ev.type === 'tuzdyk') st.tuzdyks[s] = ev.index;
      const mark =
        ev.type === 'capture'
          ? { capture: ev.index }
          : { pitClass: { [ev.index]: 'k-pit--tuzdyk-new' } };
      render(mark);
      await sleep(T(ev.type === 'capture' ? '--duration-capture-hold' : '--duration-tuzdyk-mark'));
      const src = pitCenter(L, ev.index, me),
        base = st.kazans[s];
      st.pits[ev.index] = 0;
      render(mark);
      const flights: Promise<void>[] = [];
      for (let j = 0; j < Math.min(count, cap); j++)
        flights.push(
          fly(
            o.fx(),
            src,
            kazanSlot(L, s, me, base + j),
            kBallR(),
            T('--duration-capture-flight'),
            str('--ease-out'),
            j * T('--delay-capture-stagger'),
          ),
        );
      await Promise.all(flights);
      st.kazans[s] += count;
      render({ kazanClass: { [ev.by]: 'k-kazan--bump' } });
    } else if (ev.type === 'collect') {
      const s = sideI(ev.side),
        flights: Promise<void>[] = [];
      const base = st.kazans[s];
      let j = 0;
      for (let i = s * 9; i < s * 9 + 9; i++) {
        const n = st.pits[i] ?? 0;
        if (!n) continue;
        const src = pitCenter(L, i, me);
        for (let q = 0; q < Math.min(n, cap); q++, j++)
          flights.push(
            fly(
              o.fx(),
              src,
              kazanSlot(L, s, me, base + j),
              kBallR(),
              T('--duration-collect-flight'),
              str('--ease-out'),
              j * T('--delay-collect-stagger'),
            ),
          );
        st.kazans[s] += n;
        st.pits[i] = 0;
      }
      await Promise.all(flights);
      render({ kazanClass: { [ev.side]: 'k-kazan--bump' } });
    } else if (ev.type === 'game_over') {
      o.onGameOver?.(ev.status);
    }
  }
  return { state: st, hl };
}

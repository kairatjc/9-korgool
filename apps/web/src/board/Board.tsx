/* Board — React port of renderBoard / mountBoard from design/handoff/board.js.
   Same SVG structure, classes and numbers; React only replaces string templates. */
import type { GameState, Side } from '@korgool/engine';
import { memo, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import {
  GEO,
  ballPositions,
  kazanBadge,
  pitGeom,
  previewWidth,
  r2,
  type BallPos,
  type KazanBox,
  type Layout,
} from './geometry';

export type BoardState = Pick<GameState, 'pits' | 'kazans' | 'tuzdyks' | 'turn'>;

export interface BoardOptions {
  layout: Layout;
  /** Whose point of view the board is drawn from (my row at the bottom / right). */
  me?: Side;
  /** Who may move now; defaults to `me`. In hot-seat games it follows the turn. */
  actor?: Side;
  uid?: string;
  interactive?: boolean;
  /** Board indices allowed to move (tutorial). */
  legalOnly?: readonly number[];
  lastFrom?: number | null;
  lastTo?: number | null;
  capture?: number | null;
  hint?: number | null;
  hover?: number | null;
  pressed?: number | null;
  previewTarget?: number | null;
  previewLabel?: string;
  /** Extra classes per board index (motion: lifting, bump, tuzdyk-new). */
  pitClass?: Readonly<Record<number, string>>;
  /** Extra classes per kazan side (motion: bump). */
  kazanClass?: Partial<Record<Side, string>>;
}

function Balls({ list, r }: { list: BallPos[]; r: number }) {
  return (
    <>
      {list.map((p, k) => (
        <use
          key={k}
          href="#k-ball"
          className={p.layer ? 'k-ball k-ball--top' : 'k-ball'}
          transform={`translate(${p.x} ${p.y}) scale(${r})`}
        />
      ))}
    </>
  );
}

/** Latest event handlers of a board; pits read them through a ref so they never re-render for new callbacks. */
interface PitEvents {
  onPit?: ((index: number) => void) | undefined;
  onPitHover?: ((index: number | null) => void) | undefined;
  press: (index: number | null) => void;
}

export interface PitProps {
  L: Layout;
  me: Side;
  i: number;
  n: number;
  className: string;
  label: string;
  /** Legal pits get click / hover / press handlers. */
  legal?: boolean;
  events?: RefObject<PitEvents>;
}

/* Memoized: during move playback only the pits that changed are re-rendered. */
export const Pit = memo(function Pit({ L, me, i, n, className, label, legal, events }: PitProps) {
  const g = pitGeom(L, i, me);
  const G = GEO[L],
    { rx, ry } = G.pit,
    R = G.ring,
    a = r2(Math.min(rx, ry) * 0.55);
  const P = G.pill,
    V = G.preview;
  const lw = previewWidth(L, label);
  const release = () => events?.current.press(null);
  const handlers =
    legal && events
      ? {
          onClick: () => events.current.onPit?.(i),
          onMouseEnter: () => events.current.onPitHover?.(i),
          onMouseLeave: () => events.current.onPitHover?.(null),
          onPointerDown: () => events.current.press(i),
          onPointerUp: release,
          onPointerLeave: release,
          onPointerCancel: release,
        }
      : {};
  return (
    <g
      className={className}
      data-component="Pit"
      data-index={i}
      data-number={g.p + 1}
      {...handlers}
    >
      <rect className="k-pit__hit" x={g.hit.x} y={g.hit.y} width={g.hit.w} height={g.hit.h} />
      <ellipse className="k-pit__ring" cx={g.cx} cy={g.cy} rx={rx + R} ry={ry + R} />
      <ellipse className="k-pit__well" cx={g.cx} cy={g.cy} rx={rx} ry={ry} />
      <ellipse className="k-pit__shade" cx={g.cx} cy={g.cy - 1.5} rx={rx - 2} ry={ry - 2.5} />
      <ellipse className="k-pit__tint" cx={g.cx} cy={g.cy} rx={rx} ry={ry} />
      <g className="k-pit__balls">
        <Balls
          list={ballPositions(n, { kind: 'pit', cx: g.cx, cy: g.cy, rx, ry, r: G.ballR })}
          r={G.ballR}
        />
      </g>
      <path
        className="k-pit__mark"
        pathLength={1}
        d={`M${g.cx - a} ${g.cy - a} L${g.cx + a} ${g.cy + a} M${g.cx + a} ${g.cy - a} L${g.cx - a} ${g.cy + a}`}
      />
      <g className="k-pit__count">
        <rect
          className="k-pit__count-bg"
          x={g.pill.x - P.w / 2}
          y={g.pill.y - P.h / 2}
          width={P.w}
          height={P.h}
          rx={P.h / 2}
        />
        <text
          className="k-pit__count-text"
          x={g.pill.x}
          y={g.pill.y}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {n}
        </text>
      </g>
      <text
        className="k-pit__number"
        x={g.num.x}
        y={g.num.y}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {g.p + 1}
      </text>
      <g className="k-pit__preview">
        <rect
          className="k-pit__preview-bg"
          x={r2(g.cx - lw / 2)}
          y={g.cy - V.h / 2}
          width={lw}
          height={V.h}
          rx={V.h / 2}
        />
        <text
          className="k-pit__preview-text"
          x={g.cx}
          y={g.cy}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {label}
        </text>
      </g>
    </g>
  );
});

export const Kazan = memo(function Kazan({
  L,
  k,
  side,
  count,
  mine,
  extra,
}: {
  L: Layout;
  k: KazanBox;
  side: 0 | 1;
  count: number;
  mine: boolean;
  extra?: string | undefined;
}) {
  const G = GEO[L],
    rr = Math.min(k.w, k.h) / 2,
    along = 4 + G.badgeR + 4;
  const bx =
    k.axis === 'x' ? (k.from === 'start' ? k.x + along : k.x + k.w - along) : k.x + k.w / 2;
  const by =
    k.axis === 'y' ? (k.from === 'start' ? k.y + along : k.y + k.h - along) : k.y + k.h / 2;
  const balls = ballPositions(count, { kind: 'kazan', r: G.kBallR, badge: kazanBadge(L), ...k });
  return (
    <g
      className={`k-kazan k-kazan--${mine ? 'mine' : 'opponent'}${extra ? ' ' + extra : ''}`}
      data-component="Kazan"
      data-side={side ? 'black' : 'white'}
    >
      <rect className="k-kazan__well" x={k.x} y={k.y} width={k.w} height={k.h} rx={rr} />
      <g className="k-kazan__balls">
        <Balls list={balls} r={G.kBallR} />
      </g>
      <g className="k-kazan__count">
        <circle className="k-kazan__count-bg" cx={bx} cy={by} r={G.badgeR} />
        <text
          className="k-kazan__count-text"
          x={bx}
          y={by}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {count}
        </text>
      </g>
    </g>
  );
});

const Base = memo(function Base({ L, uid }: { L: Layout; uid: string }) {
  const G = GEO[L],
    W = G.w,
    H = G.h,
    I = G.inlayInset,
    m = G.medal;
  return (
    <>
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect width={W} height={H} rx={G.radius} />
        </clipPath>
      </defs>
      <g className="k-board__base" clipPath={`url(#${uid}-clip)`}>
        <rect className="k-board__half k-board__half--opp" width={W} height={H} />
        <path className="k-board__half k-board__half--mine" d={G.mineHalf} />
        <rect className="k-board__grain" width={W} height={H} filter={`url(#k-grain-${L})`} />
      </g>
      <rect
        className="k-board__frame"
        x="1.5"
        y="1.5"
        width={W - 3}
        height={H - 3}
        rx={G.radius - 1}
      />
      <rect
        className="k-board__inlay"
        x={I}
        y={I}
        width={W - 2 * I}
        height={H - 2 * I}
        rx={G.radius - 7}
      />
      <path className="k-board__seam" d={G.seam} />
      <use
        href="#k-ornament"
        className="k-board__medallion"
        x={m.x - m.r}
        y={m.y - m.r}
        width={m.r * 2}
        height={m.r * 2}
      />
    </>
  );
});

export interface BoardProps extends BoardOptions {
  state: BoardState;
  onPit?: (index: number) => void;
  onPitHover?: (index: number | null) => void;
}

export function Board({ state: st, onPit, onPitHover, ...o }: BoardProps) {
  const [pressedLocal, setPressed] = useState<number | null>(null);
  const events = useRef<PitEvents>({ press: setPressed });
  events.current = { onPit, onPitHover, press: setPressed };
  const L: Layout = o.layout === 'v' ? 'v' : 'h',
    G = GEO[L],
    me: Side = o.me === 'black' ? 'black' : 'white';
  const meI = me === 'white' ? 0 : 1,
    opI = meI === 0 ? 1 : 0,
    uid = o.uid ?? 'kb';
  const actor = o.actor ?? me;
  const interactive = o.interactive !== false;
  const pressed = o.pressed ?? pressedLocal;
  const pits: ReactNode[] = [];
  for (let i = 0; i < 18; i++) {
    const g = pitGeom(L, i, me),
      n = st.pits[i] ?? 0;
    const tzMine = st.tuzdyks[meI] === i,
      tzOpp = st.tuzdyks[opI] === i;
    const cls = ['k-pit', g.mine ? 'k-pit--mine' : 'k-pit--opponent'];
    if (tzMine) cls.push('k-pit--tuzdyk-mine');
    if (tzOpp) cls.push('k-pit--tuzdyk-opponent');
    let legal = false;
    if (interactive) {
      const actorsPit = i < 9 === (actor === 'white');
      const tzOther = st.tuzdyks[actor === 'white' ? 1 : 0] === i;
      legal =
        st.turn === actor &&
        actorsPit &&
        n > 0 &&
        !tzOther &&
        (!o.legalOnly || o.legalOnly.includes(i));
      cls.push(legal ? 'k-pit--legal' : 'k-pit--disabled');
    }
    if (o.lastFrom === i) cls.push('k-pit--last-move-from');
    if (o.lastTo === i) cls.push('k-pit--last-move-to');
    if (o.capture === i) cls.push('k-pit--capture');
    if (o.hint === i) cls.push('k-pit--hint');
    if (o.hover === i) cls.push('k-pit--hover');
    if (pressed === i) cls.push('k-pit--pressed');
    if (o.previewTarget === i) cls.push('k-pit--preview-target');
    const extra = o.pitClass?.[i];
    if (extra) cls.push(extra);
    pits.push(
      <Pit
        key={i}
        L={L}
        me={me}
        i={i}
        n={n}
        className={cls.join(' ')}
        label={o.previewTarget === i ? (o.previewLabel ?? '') : ''}
        legal={legal}
        events={events}
      />,
    );
  }
  const side = (s: 0 | 1): Side => (s ? 'black' : 'white');
  return (
    <svg
      className={`k-board k-board--${L}`}
      data-component="Board"
      viewBox={`0 0 ${G.w} ${G.h}`}
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      <Base L={L} uid={uid} />
      <Kazan
        L={L}
        k={G.kazan.mine}
        side={meI}
        count={st.kazans[meI]}
        mine
        extra={o.kazanClass?.[side(meI)]}
      />
      <Kazan
        L={L}
        k={G.kazan.opp}
        side={opI}
        count={st.kazans[opI]}
        mine={false}
        extra={o.kazanClass?.[side(opI)]}
      />
      {pits}
    </svg>
  );
}

/** Board + an FX layer (same viewBox) for flying balls — the React counterpart of mountBoard's host. */
export function BoardHost({ fxRef, ...props }: BoardProps & { fxRef?: Ref<SVGSVGElement> }) {
  const L: Layout = props.layout === 'v' ? 'v' : 'h',
    G = GEO[L];
  return (
    <>
      <Board {...props} />
      <svg
        ref={fxRef}
        className="k-board-fx"
        viewBox={`0 0 ${G.w} ${G.h}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        data-ball-r={G.ballR}
        data-kazan-ball-r={G.kBallR}
      />
    </>
  );
}

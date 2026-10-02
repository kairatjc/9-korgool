/* Rules diagrams and spec-sheet samples — ports of renderDiagram / renderPitSample / renderKazanSample
   from design/handoff/board.js. */
import { Fragment } from 'react';
import { Kazan, Pit } from './Board';
import { GEO, pitGeom, type Layout } from './geometry';

export type DiagramPitState = 'from' | 'to' | 'capture' | 'tuzdyk-mine';

/** 5 columns: my pits 5–9 (bottom, `b0..b4`) and opponent pits 5–1 (top, `t0..t4`). */
export interface DiagramData {
  bottom: readonly number[];
  top: readonly number[];
  states?: Readonly<Record<string, DiagramPitState>>;
  arrow?: readonly [string, string];
  labels?: Readonly<Record<string, string>>;
}

export function Diagram({ d, uid = 'kd' }: { d: DiagramData; uid?: string }) {
  const C = 72,
    R = 26,
    W = 5 * C + 16,
    H = 196,
    Y = { t: 48, b: 148 },
    mid = H / 2,
    a = 13;
  const cx = (c: number) => 8 + C / 2 + c * C;
  const rows = (['t', 'b'] as const).flatMap((row) =>
    (row === 't' ? d.top : d.bottom).map((v, c) => {
      const key = row + c,
        st = d.states?.[key],
        x = cx(c),
        y = Y[row];
      const num = row === 't' ? 5 - c : 5 + c;
      return (
        <g
          key={key}
          className={`k-dpit k-dpit--${row === 'b' ? 'mine' : 'opponent'}${st ? ' k-dpit--' + st : ''}`}
        >
          <circle className="k-dpit__ring" cx={x} cy={y} r={R + 5} />
          <circle className="k-dpit__well" cx={x} cy={y} r={R} />
          <circle className="k-dpit__tint" cx={x} cy={y} r={R} />
          <path
            className="k-dpit__mark"
            d={`M${x - a} ${y - a} L${x + a} ${y + a} M${x + a} ${y - a} L${x - a} ${y + a}`}
          />
          <text
            className="k-dpit__value"
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {v}
          </text>
          <text
            className="k-dpit__number"
            x={x}
            y={row === 't' ? 12 : 186}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {num}
          </text>
        </g>
      );
    }),
  );
  let arrow = null;
  if (d.arrow) {
    const [f, t] = d.arrow,
      fx = cx(Number(f.slice(1))),
      tx = cx(Number(t.slice(1)));
    arrow = (
      <path
        className="k-diagram__arrow"
        markerEnd="url(#k-arrowhead)"
        d={`M${fx} ${Y.b - R - 8} V${mid} H${tx} V${Y.t + R + 9}`}
      />
    );
  }
  return (
    <svg
      className="k-diagram"
      data-component="RuleDiagram"
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect width={W} height={H} rx="18" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect className="k-board__half k-board__half--opp" width={W} height={mid} />
        <rect className="k-board__half k-board__half--mine" y={mid} width={W} height={mid} />
      </g>
      <path className="k-board__seam" d={`M0 ${mid} H${W}`} />
      {rows}
      {arrow}
      {Object.entries(d.labels ?? {}).map(([key, text]) => {
        const x = cx(Number(key.slice(1))) + R - 4,
          y = Y[key[0] as 't' | 'b'] - R - 2,
          w = String(text).length * 8 + 16;
        return (
          <Fragment key={key}>
            <rect className="k-diagram__label-bg" x={x} y={y - 11} width={w} height="22" rx="11" />
            <text
              className="k-diagram__label"
              x={x + w / 2}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {text}
            </text>
          </Fragment>
        );
      })}
    </svg>
  );
}

export function PitSample({
  layout = 'h',
  count,
  cls = [],
  side,
  label = '',
}: {
  layout?: Layout;
  count: number;
  cls?: readonly string[];
  side?: 'opponent' | undefined;
  label?: string | undefined;
}) {
  const L: Layout = layout === 'v' ? 'v' : 'h',
    mine = side !== 'opponent';
  const i = mine ? 0 : 9,
    g = pitGeom(L, i, 'white');
  const box =
    L === 'h'
      ? { x: g.cx - 60, y: mine ? 296 : 0, w: 120, h: 184 }
      : { x: mine ? 236 : 0, y: g.cy - 36, w: 144, h: 72 };
  const classes = ['k-pit', mine ? 'k-pit--mine' : 'k-pit--opponent', ...cls];
  return (
    <svg
      className={`k-board k-board--${L}`}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        className={`k-board__half k-board__half--${mine ? 'mine' : 'opp'}`}
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
      />
      <Pit L={L} me="white" i={i} n={count} className={classes.join(' ')} label={label} />
    </svg>
  );
}

export function KazanSample({ layout = 'h', count }: { layout?: Layout; count: number }) {
  const L: Layout = layout === 'v' ? 'v' : 'h',
    k = GEO[L].kazan.mine;
  return (
    <svg
      className={`k-board k-board--${L}`}
      viewBox={`${k.x - 8} ${k.y - 8} ${k.w + 16} ${k.h + 16}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        className="k-board__half k-board__half--mine"
        x={k.x - 8}
        y={k.y - 8}
        width={k.w + 16}
        height={k.h + 16}
      />
      <Kazan L={L} k={k} side={0} count={count} mine />
    </svg>
  );
}

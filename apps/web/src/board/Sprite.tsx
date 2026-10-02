/* Shared SVG defs (gradients, grain filters, ball, ornament, arrowhead) — same as SPRITE in design/handoff/board.js.
   Rendered once at the app root; every board and icon references it by id. */

const ORNAMENT_D =
  'M0 -1.5 C0 -5 -1 -7.5 -4 -8.5 C-7 -9.5 -9.2 -6.5 -7.6 -4.6 C-6.4 -3.3 -4.6 -4.2 -5.3 -5.6 M0 -1.5 C0 -5 1 -7.5 4 -8.5 C7 -9.5 9.2 -6.5 7.6 -4.6 C6.4 -3.3 4.6 -4.2 5.3 -5.6';

const GRAIN_MATRIX = '0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  1.5 0 0 0 -0.5';

export function Sprite() {
  return (
    <svg
      className="k-sprite"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="k-grad-board-opp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="k-stop--board-opp-1" />
          <stop offset="1" className="k-stop--board-opp-2" />
        </linearGradient>
        <linearGradient id="k-grad-board-mine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="k-stop--board-mine-1" />
          <stop offset="1" className="k-stop--board-mine-2" />
        </linearGradient>
        <linearGradient id="k-grad-pit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="k-stop--pit-1" />
          <stop offset="1" className="k-stop--pit-2" />
        </linearGradient>
        <radialGradient id="k-grad-ball" cx=".35" cy=".3" r=".75">
          <stop offset="0" className="k-stop--ball-hi" />
          <stop offset=".55" className="k-stop--ball-mid" />
          <stop offset="1" className="k-stop--ball-lo" />
        </radialGradient>
        <filter id="k-grain-h" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves={3} seed={7} />
          <feColorMatrix type="matrix" values={GRAIN_MATRIX} />
        </filter>
        <filter id="k-grain-v" x="0" y="0" width="1" height="1">
          <feTurbulence type="fractalNoise" baseFrequency="0.09 0.004" numOctaves={3} seed={7} />
          <feColorMatrix type="matrix" values={GRAIN_MATRIX} />
        </filter>
        <g id="k-ball">
          <ellipse className="k-ball__shadow" cx=".15" cy=".45" rx=".95" ry=".6" />
          <circle className="k-ball__body" r="1" />
        </g>
        <symbol id="k-ornament" viewBox="-11 -11 22 22">
          {[0, 90, 180, 270].map((a) => (
            <g key={a} transform={`rotate(${a})`}>
              <path
                d={ORNAMENT_D}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </g>
          ))}
          <path d="M0 -2.2 L2.2 0 L0 2.2 L-2.2 0Z" fill="currentColor" />
        </symbol>
        <marker
          id="k-arrowhead"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path className="k-diagram__arrowhead" d="M0 0 L10 5 L0 10Z" />
        </marker>
      </defs>
    </svg>
  );
}

/** The кочкор мүйүз medallion (`#k-ornament`), used by the logo, matchmaking and modals. */
export function Ornament({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true">
      <use href="#k-ornament" />
    </svg>
  );
}

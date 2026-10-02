# Board spec — «Тогуз коргоол»

All numbers below are SVG user units inside the board `viewBox`. The SVG scales to its container
with `preserveAspectRatio="xMidYMid meet"`; nothing inside the board depends on CSS pixels.
Source of truth: `board.js` (`GEO`, `pitGeom`, `ballPositions`).

## Index model
- `0..8` — White pits 1..9, `9..17` — Black pits 1..9. Sowing goes up the index, wrapping 17 → 0.
- The board is always drawn from the point of view of `me` (`opts.me`, default `white`):
  my row is at the bottom (horizontal) or in the right column (vertical); my kazan is the light half.
- `state.tuzdyks = [whiteTuzdykIndex, blackTuzdykIndex]`. White's tuzdyk is always an index 9..17.

## Horizontal layout `h` — viewBox `0 0 1000 480`
Used at ≥ 768 px and for the home illustration.

| element | geometry |
|---|---|
| board | rect 1000×480, rx 28; frame stroke inset 1.5; inlay rect inset 9, rx 21 |
| pit centres, my row | `x = 76 + p·106` (p = 0..8 → pit 1..9 left→right), `y = 384` |
| pit centres, opponent row | `x = 76 + (8−p)·106` (their pit 1 is on my right), `y = 96` |
| pit | ellipse rx 44, ry 54; state ring rx 49, ry 59 |
| hit area | 106×180: my row y 300..480, opponent row y 0..180 (covers pit, counter, number) |
| counter pill | 40×24, rx 12, centred at (x, 312) mine / (x, 168) opponent |
| pit number | centred at (x, 462) mine / (x, 22) opponent |
| preview badge | centred on the pit, height 26, width = chars·9 + 28 |
| my kazan | rect x 524, y 192, 440×96, rx 48; count badge r 24 at the right end (cx 932) |
| opponent kazan | rect x 36, y 192, 440×96, rx 48; count badge at the left end (cx 68) |
| medallion | centre (500, 240), 40×40 (`#k-ornament`) |
| seam | `M0 294 H480 Q500 294 500 274 V206 Q500 186 520 186 H1000` — light half below |
| balls | pit r 8.5, kazan r 7.5 |

## Vertical layout `v` — viewBox `0 0 380 640`
Used below 768 px (phones, portrait). Pits are 80×62 units → at 360 px wide (scale ≈ 0.89) a pit is ≈ 71×55 px,
and its hit row is 121×61 px — above the 44×44 minimum.

| element | geometry |
|---|---|
| board | rect 380×640, rx 26; inlay inset 9 |
| my column | `x = 316`, `y = 44 + (8−p)·69` (pit 1 at the bottom, pit 9 at the top) |
| opponent column | `x = 64`, `y = 44 + p·69` (their pit 1 at the top) |
| pit | ellipse rx 40, ry 31; ring rx 45, ry 36 |
| hit area | 136×69: mine x 244..380, opponent x 0..136 |
| counter pill | 30×20, at x 259 mine / x 121 opponent, same y as the pit |
| pit number | x 370 mine / x 10 opponent |
| preview badge | height 22, width = chars·7.5 + 20 |
| my kazan | rect x 144, y 336, 92×290, badge r 18 at the bottom end |
| opponent kazan | rect x 144, y 14, 92×290, badge at the top end |
| medallion | centre (190, 320), 24×24 |
| seam | `M240 0 V300 Q240 320 220 320 H160 Q140 320 140 340 V640` — light half on the right/bottom |
| balls | pit r 6, kazan r 6 |

Sowing direction is counter-clockwise in both layouts (h: right along my row, left along theirs;
v: up my column, down theirs).

## Breakpoints
| viewport | layout |
|---|---|
| 360–767 | `v`, board fills the free height between the plates (`flex: 1`), scales by `meet` |
| 768–1199 | `h`, full content width, `aspect-ratio: 1000/480`; move list collapses to a strip |
| ≥ 1200 | `h` in the left column, sidebar 340 px with move list and actions |

Switching is done in JS with `matchMedia('(max-width: 767px)')` → `layout: 'v' | 'h'`.
Landscape phones (< 768 px tall but ≥ 768 wide) get `h`; not tuned (see README).

## `ballPositions(count, slot)`
Deterministic; no randomness.

**Pit** (`slot = {kind:'pit', cx, cy, rx, ry, r}`):
1. Build a hex lattice with spacing `s = 2r + 1` inside the inner ellipse `(rx − r − 1, ry − r − 1)`.
2. Sort points by normalised distance from the centre `(x/rx)² + (y/ry)²`, ties by angle (both rounded to 1e-6).
3. `count ≤ 14` (`PIT_N`): take the first `count` points, shift by their centroid so the group is centred.
4. `count > 14`: heap — every lattice point (layer 0) plus up to 7 points of a second layer
   offset by `(s/2, 0.289·s)` inside 62 % of the ellipse. The counter pill always shows the real number.

**Kazan** (`slot = {kind:'kazan', x, y, w, h, axis, from, r, badge}`):
hex columns across the short side, filled column by column starting after the count badge
(`badge = 2·badgeR + 8`) and moving away from it. Up to 100 balls (`KAZAN_N`); more → full kazan + number.

**Ball**: `<use href="#k-ball">` scaled by `r`; unit shape = shadow ellipse (cx .15, cy .45, rx .95, ry .6) +
circle r 1 filled with the radial gradient `#k-grad-ball` (cx .35, cy .3, r .75; stops hi / mid .55 / lo).

## Textures
- Wood grain: `feTurbulence fractalNoise`, `baseFrequency 0.004 0.09` (h) / `0.09 0.004` (v), 3 octaves, `seed 7`,
  converted to a dark brown alpha mask (`feColorMatrix`, alpha = 1.5·R − 0.5). Deterministic in Chromium/WebKit/Gecko.
- Halves: `#k-grad-board-opp` and `#k-grad-board-mine`, vertical linear gradients, colors from tokens.
- Pits: `#k-grad-pit` + a 3-unit dark inner stroke (`.k-pit__shade`).

## Rules diagram (`renderDiagram`) — viewBox `0 0 376 196`
5 columns × 72, circle r 26, rows at y 48 (opponent pits 5→1) and 148 (my pits 5→9), seam at y 98.
Arrow path: `M fromX 114 V98 H toX V83` with `#k-arrowhead`.

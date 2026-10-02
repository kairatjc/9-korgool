# Тогуз коргоол — UI handoff (direction 1a «Жаңгак»)

Plain HTML + CSS + vanilla JS. Open `index.html` over any static server (or directly from disk —
copy is also shipped as `copy.js`, so no fetch is needed).

## Files
| file | what |
|---|---|
| `tokens.css` / `tokens.json` | every raw value (colors, type, spacing, sizes, radii, shadows, z-index, motion, board strokes) |
| `components.css` | all component styles, tokens only. Breakpoints: 768 / 1024 / 1200 px (CSS can't read vars in `@media`) |
| `index.html` | all screens as static markup with `data-i18n` keys and `data-component` names |
| `app.js` | router, i18n, fixtures, screen wiring (prototype glue — not a component) |
| `board.js` | `renderBoard`, `mountBoard`, `ballPositions`, geometry `GEO`, rules `computeMove`, samples, rule diagrams, SVG sprite |
| `motion.js` | `KMotion.playMove(host, state, events, opts)` |
| `copy.json` / `copy.js` | strings ru / ky / en (`copy.js` is generated from `copy.json`) |
| `components.md` | component list: parts, modifiers, states |
| `board-spec.md` | viewBox, coordinates, ball layout, breakpoints |
| `assets/ornament.svg` | кочкор мүйүз medallion (same as `#k-ornament` symbol) |

## Fonts (Google Fonts)
- **Rubik** 500, 600 — display (logo, titles, scores, big numbers)
- **Golos Text** 400, 500, 600 — UI and board counters

Both include Cyrillic Extended: «Оюнчу, Бүркүт, Жеңиш, Өнөр» render without fallback.
Link: `https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Rubik:wght@500;600&display=swap`

## Icons — Lucide 0.469.0
`arrow-left, globe, chevron-down, chevron-right, chevron-up, log-in, users, bot, smartphone, book-open, graduation-cap,
key-round, copy, message-circle, send, list, x, settings, undo-2, lightbulb, handshake, arrow-up-down, flag, wifi-off,
rotate-ccw, map-pin, pencil, play`. In React use `lucide-react` with the same names.

## URL parameters
`index.html?screen=<id>&fixture=<id>&state=<state>&static=1`

- `screen`: `home`, `bot-setup`, `friend-create`, `friend-wait`, `join-code`, `matchmaking`, `matchmaking-offer-bot`,
  `game`, `game-over`, `sign-in`, `profile`, `rules`, `tutorial`, `settings`, plus `spec` (pit states / balls / kazan / clock sheet).
- `fixture` (game): `start`, `midgame` (default), `endgame`, `gameover` (default for `game-over`).
- `state` (game): `my-turn`, `opponent-turn`, `preview`, `low-time`, `reconnecting`, `opponent-offline`, `resign-confirm`,
  plus `history-open` (phone move-list sheet). `state=signed-in` on `home` shows the avatar instead of «Войти».
- `static=1`: all CSS animations/transitions off, move playback instant, timers frozen, dev bar hidden.
- Extras: `lang=ru|ky|en` (default ru), `mode=online|bot|friend|local` (default online; bot adds Undo/Hint and hides clocks),
  `outcome=win|loss|draw` and `reason=82|noMoves|time|resign|disconnect` for `game-over`.

`midgame` uses the agreed highlight: last-move-from = opponent pit 5 (index 13), last-move-to = my pit 3 (index 2).

## Interaction in the prototype
- Game: legal pits are clickable and play a real move (`computeMove` → `playMove`). Hover on a legal pit (desktop)
  shows the preview target and «+N» / «туздук» if the move captures or makes a tuzdyk.
- Dev bar (bottom-right, hidden with `static=1`): «Проиграть ход» resets to `start` and plays the event list from the brief;
  speed selector = slow / normal / fast / off.
- Tutorial: only pit 7 is legal; tapping it plays the move.
- Settings: animation speed is saved to `localStorage['k.speed']` and used by playback.

## Motion (all values in `tokens.css`, multiplied by `--speed-*`: slow 1.6, normal 1, fast 0.55, off 0)
| event | what happens | timing |
|---|---|---|
| `pickup {index,count}` | balls in the pit fade up (`--motion-lift-y`), counter → 0, pit gets last-move-from | `--duration-pickup` 240 ms, `--ease-pickup` |
| `sow {index,toKazan:null}` | one ball flies on an arc from the previous pit to `index`; on landing counter +1 with bump; pit becomes last-move-to | flight `--duration-sow-flight` 260 ms, `--ease-sow`; then `--delay-sow-step` 70 ms; bump `--duration-counter-bump` 180 ms `--ease-bump` |
| `sow {toKazan:"white"\|"black"}` | ball flies to the tuzdyk, then on to its owner's kazan slot; kazan +1 with bump | 2 × flight |
| `capture {index,count,by}` | pit flashes capture state, then up to 12 (`--motion-flight-cap`) balls fly to `by`'s kazan, staggered; kazan += count | hold `--duration-capture-hold` 280 ms; flight `--duration-capture-flight` 460 ms `--ease-out`; stagger `--delay-capture-stagger` 35 ms |
| `tuzdyk {index,by}` | X draws in (stroke-dashoffset), then the pit's balls fly to `by`'s kazan | `--duration-tuzdyk-mark` 520 ms, then capture flight |
| `collect {side,count}` | every pit on `side` empties into its kazan | `--duration-collect-flight` 600 ms, stagger `--delay-collect-stagger` 25 ms |
| `game_over {status}` | `opts.onGameOver(status)` → app shows the result modal | — |

Arc: quadratic Bézier, control point lifted by `min(--motion-arc-max (70 units), distance × --motion-arc-lift (0.35))`, sampled in 12 keyframes; easing applies to the whole flight.
Implementation: the board is re-rendered from state after each landing (cheap, ~1 ms); flying balls live in a separate
`.k-board-fx` SVG with the same viewBox on top of the board.

## Known compromises (honest list)
- **Previews were reviewed in a limited environment.** The review canvas («Экраны.dc.html») embeds every URL, but I could not
  pixel-check every state myself; spacing at 768–1199 px is the least reviewed.
- **Google button** uses the Lucide `log-in` icon. Google's sign-in branding requires their official «G» mark — add it per their guidelines.
- **WhatsApp / Telegram** buttons use generic Lucide icons (`message-circle`, `send`); Lucide has no brand icons.
- **Grain filter colour** (`feColorMatrix` in `board.js`) and the SVG ornament/ball unit shapes contain raw numbers — they are board geometry/texture, as allowed by 6.1.
- **Keyframe numbers** (`scale(0.45)`, opacity 0.7/0.55 in `components.css` keyframes, `scale(0.98)` on button press) are inline, not tokens.
- **Kyrgyz translations** were written by me, not by a native speaker; please proof-read `copy.json` (especially rules and tutorial). Long ky strings were checked on the game, home and game-over screens only.
- **«отау» / «уя»**: Russian copy uses «лунка», Kyrgyz uses «уя»; adjust if you prefer «отоо».
- **Bot, matchmaking, friend rooms, clocks** are visual only: clocks don't tick, the bot doesn't reply, codes aren't validated.
- **Undo / Hint / Offer draw** buttons have no behaviour in the prototype.
- **Landscape phones** (≥ 768 px wide, short height) get the horizontal board without a tuned layout.
- **Preview on `midgame` pit 7** (23 balls) lands on opponent pit 2 without a capture, so the badge is empty there;
  the «+10» badge is shown on the `spec` screen. Hover other pits in the live prototype to see real labels.
- **Pit counters in the vertical layout** are 12 units (~11 px at 360 px width) — readable but small; numbers on pills are ≥ 3:1 (dark on cream, ~14:1).
- Fonts load from Google; until they arrive the fallback is sans-serif (no layout shift handling).
- Six-step tutorial: only step 2 is designed, as requested.

## Self-check (6.7)
- [x] No raw colours/sizes in `components.css` outside tokens (scripted check; exceptions listed above).
- [x] Every screen opens from its URL; all 4 fixtures are drawn by `renderBoard`.
- [x] 360 px: no horizontal scroll by construction (`minmax(0,1fr)`, ellipsis on names); pit hit area ≥ 44×44 px (see board-spec).
- [x] Text contrast ≥ 4.5:1 (ink #261A12 on #F3EDE4 ≈ 14:1, muted #6E5D50 on #E8DED0 ≈ 4.6:1); counters ≥ 3:1.
- [x] No `Math.random`, no canvas, no raster images; icons are Lucide by name.
- [x] ң, ө, ү render in Rubik and Golos Text.

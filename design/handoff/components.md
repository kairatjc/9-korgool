# Components

Naming: `.k-<component>`, `.k-<component>__<part>`, `.k-<component>--<modifier>`.
Every component root carries `data-component="<ReactName>"`. States are modifiers only.
All styles live in `components.css`; all values are tokens from `tokens.css`.

## App shell
| Component | Class | Parts | Modifiers / states |
|---|---|---|---|
| Screen | `.k-screen` | — | `.k-game`, `.k-home`, `.k-tutorial` (full-height screens) |
| TopBar | `.k-topbar` | `__title`, `__spacer`, `__logo` (≥768 only), `__end` | — |
| Logo | `.k-logo` | `__mark` (svg `#k-ornament`), `__name`, `__tagline` | `--inline` |
| Page | `.k-page` | `__title`, `__lead`, `__note`, `__stack`, `__footer` | `--article`, `--wide`, `--center` |
| SectionTitle | `.k-section-title` | — | — |
| LanguageSelect | `.k-lang` | `__select` (native select) | — |

## Controls
| Component | Class | Parts | Modifiers / states |
|---|---|---|---|
| Button | `.k-button` | `__label`, `__sub`, Lucide icon | `--primary`, `--ink`, `--ghost`, `--ghost-inverse`, `--danger`, `--block`, `--sm`, `--lg`, `--hero`; `:hover`, `:active`, `:disabled`, `:focus-visible` |
| IconButton | `.k-icon-button` | Lucide icon | `:hover` |
| Link | `.k-link` | icon + text | `:hover` |
| Choice (bot level) | `.k-choice` in `.k-choice-grid` | `__title`, `__sub`, `.k-pips` | `--selected` |
| Pips | `.k-pips` | `__pip` | `__pip--on` |
| Segmented | `.k-segmented` | `__option` | `__option--selected` |
| Chips (time control) | `.k-chips` | `.k-chip` | `.k-chip--selected` |
| Toggle | `.k-toggle` | `__knob` | `--on` (`role="switch"`, `aria-checked`) |
| CodeInput | `.k-code` | `__cell`, `__input` (transparent real input) | `__cell--filled`, `__cell--focus` |
| ShareField | `.k-field` | `__value` | — |
| Menu (home) | `.k-menu` | `__item`, `__icon`, `__label`, `__chevron` | `:hover` |
| FieldGroup | `.k-field-group` | `__label` | — |

## Display
| Component | Class | Parts | Modifiers / states |
|---|---|---|---|
| Avatar | `.k-avatar` | initial or Lucide icon | `--light` (White side), `--sm`, `--lg`, `--xl` |
| Badge | `.k-badge` | — | `--accent`, `--muted`, `--success`, `--danger` |
| SideDot | `.k-side-dot` | — | `--white`, `--black`, `--random` |
| RoomCode | `.k-room-code` | `__label`, `__value` | — |
| Spinner | `.k-spinner` | — | `--lg` |
| SearchPulse | `.k-search` | `__ring` (`--2`, `--3`), `__core`, `__meta`, `__title`, `__timer` | static: fixed ring scales |
| Card (offer) | `.k-card` | `__title`, `__text`, `__actions` | — |
| Stats | `.k-stats` | `__item`, `__value`, `__label` | — |
| HistoryList | `.k-history` | `__item`, `__main`, `__name`, `__date`, `__end`, `__score` | result badge `--success/--danger/--muted` |
| Article | `.k-article` | `__section`, `__heading`, `__text` | — |
| RuleFigure | `.k-figure` | `__caption` + `.k-diagram` svg | — |
| CoachMark | `.k-coach` | `__step`, `__title`, `__text`, `__actions` | — |
| Progress | `.k-progress` | `__seg` | `__seg--done`, `__seg--current` |
| SettingsList | `.k-list` | `__item`, `__text`, `__title`, `__sub` | `__item--stack` |

## Game
| Component | Class | Parts | Modifiers / states |
|---|---|---|---|
| GameScreen | `.k-game` | `__body`, `__main`, `__board`, `__side`, `__actions`, `__action`, `__action-long` (≥1200), `__action-short` (<1200) | — |
| PlayerPlate | `.k-player` | `__info`, `__line`, `__name`, `__side`, `__turn`, `__offline` | `--me`, `--opponent`, `--active` (shows turn badge), `--offline`, `--no-clock` |
| Clock | `.k-clock` | — | default (idle), `--running`, `--low` (< 20 s, blinks), `--flag` (time out) |
| MoveList | `.k-moves` | `__strip`, `__strip-text`, `__header`, `__list`, `__row`, `__num`, `__move`, `__empty` | `__move--last` |
| Banner | `.k-banner` | `__text`, `__timer` | — |
| ReconnectOverlay | `.k-overlay` | `__title`, `__sub` | — |
| Sheet | `.k-sheet` + `.k-scrim` | `__handle`, `__header`, `__title`, `__body` | — |
| Modal | `.k-modal` | `__card`, `__icon`, `__mark`, `__title`, `__text`, `__actions` | `--result`, `--win`, `--loss`, `--draw` |
| Score | `.k-score` | `__player`, `__name`, `__value`, `__sep` | — |
| DevBar | `.k-devbar` | `__select` | prototype only, hidden with `static=1` |

## Board (SVG, rendered by `board.js`)
| Component | Class | Parts | Modifiers / states |
|---|---|---|---|
| Board | `.k-board` | `__base`, `__half` (`--opp`, `--mine`), `__grain`, `__frame`, `__inlay`, `__seam`, `__medallion` | `--h`, `--v` |
| BoardFx | `.k-board-fx` | flying `.k-ball--flying` | — |
| Pit | `.k-pit` | `__hit`, `__ring`, `__well`, `__shade`, `__tint`, `__balls`, `__mark` (X), `__count`, `__count-bg`, `__count-text`, `__number`, `__preview`, `__preview-bg`, `__preview-text` | `--mine`, `--opponent`, `--legal`, `--disabled`, `--hover`, `--pressed`, `--last-move-from`, `--last-move-to`, `--capture`, `--tuzdyk-mine`, `--tuzdyk-opponent`, `--tuzdyk-new`, `--hint`, `--preview-target`, `--lifting`, `--bump` |
| Kazan | `.k-kazan` | `__well`, `__balls`, `__count`, `__count-bg`, `__count-text` | `--mine`, `--opponent`, `--bump` |
| Ball | `.k-ball` | `__shadow`, `__body` (via `#k-ball`) | `--top` (heap layer), `--flying` |
| RuleDiagram | `.k-diagram` + `.k-dpit` | `__ring`, `__well`, `__tint`, `__mark`, `__value`, `__number`, `.k-diagram__arrow`, `__label` | `.k-dpit--from`, `--to`, `--capture`, `--tuzdyk-mine` |

### Pit states — visual rule
| state | ring | counter | other |
|---|---|---|---|
| default | none | cream pill | — |
| legal | gold 2.5 | — | `cursor: pointer` |
| hover (desktop) | light gold 4 | — | also triggers preview |
| pressed | pale gold 4 | — | well at 75 % |
| disabled | none | — | `cursor: default` |
| last-move-from | pale blue dashed | — | — |
| last-move-to | — | gold pill | — |
| capture | red 4 | red pill, white text | red tint 35 % |
| tuzdyk-mine / -opponent | — | — | owner-colour X + 18 % tint (mine red, opponent blue) |
| hint | teal 4, pulsing | — | teal tint |
| preview-target | gold dashed 4 | — | badge «+N» / «туздук» on the pit |

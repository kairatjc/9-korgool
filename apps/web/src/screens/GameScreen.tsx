import {
  applyMove,
  formatMove,
  type GameState,
  type MoveEvent,
  type Pit,
  type Side,
} from '@korgool/engine';
import {
  ArrowUpDown,
  ChevronUp,
  Flag,
  Handshake,
  Lightbulb,
  List,
  Play,
  RotateCcw,
  Settings,
  Undo2,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '../app';
import { BoardHost, type BoardState } from '../board/Board';
import { playMove, SPEEDS, type Highlight, type MotionFrame, type Speed } from '../board/motion';
import { Ornament } from '../board/Sprite';
import { useBoardLayout } from '../board/useLayout';
import { AvatarContent, SideDot, TopBar, useGo, type Person } from '../components/ui';
import { fixture, type MovePair } from '../game/fixtures';
import { useT, type T } from '../i18n';

export type GameMode = 'online' | 'bot' | 'friend' | 'local';
export const GAME_MODES: readonly GameMode[] = ['online', 'bot', 'friend', 'local'];

export type GameUiState =
  | 'my-turn'
  | 'opponent-turn'
  | 'preview'
  | 'low-time'
  | 'reconnecting'
  | 'opponent-offline'
  | 'resign-confirm'
  | 'history-open';

export type Outcome = 'win' | 'loss' | 'draw';
export type OverReason =
  '82' | 'noMoves' | 'time' | 'resign' | 'disconnect' | 'agreed' | 'cancelled';

export interface GameOver {
  outcome: Outcome;
  reason: OverReason;
  my: number;
  their: number;
}

/** Online game: moves come from the server, the player's own moves are sent to it. */
export interface OnlineProps {
  /** All moves of the game known to the server (pits 1..9). */
  moves: readonly Pit[];
  /** How many of them are already in `initial`. */
  startPly: number;
  /** Send the player's move; it is also played on the board right away. */
  send: (pit: Pit, ply: number) => void;
  /** The game ended on the server (time, resignation, disconnect, agreement, cancellation). */
  over: GameOver | null;
  /** The opponent is offline: countdown until they lose. */
  offline: { timer: string } | null;
  reconnecting: boolean;
  lowTime: boolean;
  /** The opponent offers a draw. */
  drawOffered: boolean;
  onOfferDraw: () => void;
  onAnswerDraw: (accept: boolean) => void;
}

export interface GameScreenProps {
  mode: GameMode;
  title: string;
  initial: GameState;
  /** The player's side; the board is drawn from it (flip changes only the view). */
  me?: Side;
  highlight?: Highlight;
  moves?: MovePair[];
  players: { me: Person; opponent: Person };
  /** `null` → no clocks (bot / untimed games). */
  clocks?: { me: string; opponent: string } | null;
  uiState?: GameUiState;
  over?: GameOver | null;
  /** Both sides play from this device. */
  hotSeat?: boolean;
  /** Hot-seat: turn the board to the side to move after every move. */
  autoFlip?: boolean;
  /** Vibrate on moves and captures (phones). */
  vibrate?: boolean;
  /** Opponent's move for the given position (bot games); computed off the main thread. */
  bot?: ((s: GameState) => Promise<Pit | null>) | undefined;
  /** Suggested move for the player (Hint). */
  hintMove?: ((s: GameState) => Promise<Pit | null>) | undefined;
  /** Called on confirmed resignation; by default the result modal is shown. */
  onResign?: (() => void) | undefined;
  onRematch: () => void;
  /** Prototype-only dev bar: replays this event list from the start position. */
  devbar?: readonly MoveEvent[] | undefined;
  online?: OnlineProps | undefined;
}

const BOT_DELAY = 400;

function lastSowIndex(events: readonly MoveEvent[]): number | null {
  let last: number | null = null;
  for (const ev of events) if (ev.type === 'sow') last = ev.index;
  return last;
}

/** Preview of a move: target pit and «+N» / «туздук». */
function previewOf(st: GameState, i: number, t: T): { target: number | null; label: string } {
  const mv = applyMove(st, (i % 9) + 1);
  const cap = mv.events.find((e) => e.type === 'capture');
  const label = mv.record.tuzdyk
    ? t('game.tuzdyk')
    : cap && cap.type === 'capture'
      ? '+' + cap.count
      : '';
  return { target: lastSowIndex(mv.events), label };
}

function addMove(moves: MovePair[], side: Side, note: string): MovePair[] {
  const next = moves.map((m) => m.slice() as MovePair);
  const last = next[next.length - 1];
  if (side === 'white') next.push([note]);
  else if (last && last[1] === undefined) last[1] = note;
  else next.push(['', note]);
  return next;
}

function MoveRows({ moves, t }: { moves: MovePair[]; t: T }) {
  if (!moves.length) return <div className="k-moves__empty">{t('game.noMoves')}</div>;
  return (
    <>
      {moves.map((m, i) => {
        const last = i === moves.length - 1;
        const lastCell = m[1] ? 1 : 0;
        return (
          <div key={i} className="k-moves__row">
            <span className="k-moves__num">{i + 1}.</span>
            <span
              className={
                last && lastCell === 0 ? 'k-moves__move k-moves__move--last' : 'k-moves__move'
              }
            >
              {m[0] || ''}
            </span>
            <span
              className={
                last && lastCell === 1 ? 'k-moves__move k-moves__move--last' : 'k-moves__move'
              }
            >
              {m[1] || ''}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** The last three move pairs, the latest move in bold. */
function strip(moves: MovePair[], t: T): ReactNode {
  if (!moves.length) return t('game.noMoves');
  const tail = moves.slice(-3),
    base = moves.length - tail.length;
  // One text run with only the latest move in <b>, exactly like the prototype's markup (keeps glyph shaping identical).
  const pairs = tail.map((m, k) => `${base + k + 1}. ${m[0]} ${m[1] ?? ''}`.trim());
  const last = tail[tail.length - 1];
  const bold = last?.[1] ? last[1] : (last?.[0] ?? '');
  const head = pairs
    .slice(0, -1)
    .concat(pairs[pairs.length - 1]?.slice(0, -bold.length) ?? '')
    .join(' · ');
  return (
    <>
      {head}
      <b>{bold}</b>
    </>
  );
}

function PlayerPlate({
  who,
  person,
  side,
  active,
  offline,
  noClock,
  clock,
  clockClass,
  t,
}: {
  who: 'me' | 'opponent';
  person: Person;
  side: Side;
  active: boolean;
  offline: boolean;
  noClock: boolean;
  clock: string;
  clockClass: string;
  t: T;
}) {
  const cls = [
    'k-player',
    `k-player--${who}`,
    active && 'k-player--active',
    offline && 'k-player--offline',
    noClock && 'k-player--no-clock',
  ];
  return (
    <div className={cls.filter(Boolean).join(' ')} data-component="PlayerPlate" data-player={who}>
      <div className={who === 'me' ? 'k-avatar k-avatar--light' : 'k-avatar'}>
        <AvatarContent person={person} />
      </div>
      <div className="k-player__info">
        <div className="k-player__line">
          <span className="k-player__name">{person.name}</span>
          {who === 'me' ? (
            <span className="k-badge k-badge--accent k-player__turn">{t('game.yourTurn')}</span>
          ) : (
            <>
              <span className="k-badge k-badge--muted k-player__turn">
                {t('game.opponentTurn')}
              </span>
              <span className="k-badge k-badge--danger k-player__offline">
                <WifiOff />
                <span>{t('game.offline')}</span>
              </span>
            </>
          )}
        </div>
        <div className="k-player__side">
          <SideDot side={side} />
          <span>{t(`common.${side}`)}</span>
        </div>
      </div>
      <div className={clockClass} data-component="Clock">
        {clock}
      </div>
    </div>
  );
}

function Action({
  icon,
  long,
  short,
  danger,
  onClick,
}: {
  icon: ReactNode;
  long: string;
  short: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={danger ? 'k-button k-button--danger k-game__action' : 'k-button k-game__action'}
      onClick={onClick}
    >
      {icon}
      <span className="k-game__action-long">{long}</span>
      <span className="k-game__action-short">{short}</span>
    </button>
  );
}

interface Snapshot {
  st: GameState;
  hl: Highlight;
  moves: MovePair[];
}

export function GameScreen(p: GameScreenProps) {
  const t = useT();
  const go = useGo();
  const env = useApp();
  const layout = useBoardLayout();
  const ui = p.uiState ?? 'my-turn';
  const player: Side = p.me ?? 'white';

  const [st, setSt] = useState<GameState>(() =>
    ui === 'opponent-turn'
      ? { ...p.initial, turn: player === 'white' ? 'black' : 'white' }
      : p.initial,
  );
  const [me, setMe] = useState<Side>(player);
  const [hl, setHl] = useState<Highlight>(p.highlight ?? { lastFrom: null, lastTo: null });
  const [moves, setMoves] = useState<MovePair[]>(p.moves ?? []);
  const [frame, setFrame] = useState<MotionFrame | null>(null);
  const [preview, setPreview] = useState<{ target: number | null; label: string } | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [sheet, setSheet] = useState(ui === 'history-open');
  const [resign, setResign] = useState(ui === 'resign-confirm');
  const [over, setOver] = useState<GameOver | null>(p.over ?? null);
  const [devSpeed, setDevSpeed] = useState<Speed>(env.speed);
  const [moved, setMoved] = useState(false);
  // In-game settings: the game stays mounted (hidden) underneath, see AppEnv.settings.
  // They get their own history entry (same URL), so the browser's Back / the back gesture closes them;
  // the in-app Back goes through history too, so no stale entry is left behind.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = () => {
    window.history.pushState(window.history.state, '');
    setSettingsOpen(true);
  };
  useEffect(() => {
    if (!settingsOpen) return;
    const close = () => setSettingsOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, [settingsOpen]);
  const history = useRef<Snapshot[]>([]);
  // Online: number of moves played on this board (the next move's ply).
  const ply = useRef(p.online?.startPly ?? 0);
  // The position an async hint was asked for may be gone by the time it arrives.
  const stRef = useRef(st);
  stRef.current = st;
  const fxRef = useRef<SVGSVGElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const busy = frame !== null;
  // In hot-seat games names belong to sides, so they follow the board when it turns.
  // Otherwise (as in the prototype) my name stays on the bottom plate and only the side label changes.
  const plateOf = (side: Side): Person =>
    (p.hotSeat ? side === player : side === me) ? p.players.me : p.players.opponent;
  const isOver = over !== null;
  const opp: Side = me === 'white' ? 'black' : 'white';
  const mine = st.turn === me && !isOver;
  const oppTurn = st.turn !== me && !isOver;

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [moves]);

  const speed: Speed = env.isStatic ? 'off' : p.devbar ? devSpeed : env.speed;

  async function run(events: readonly MoveEvent[], start: BoardState): Promise<Highlight | null> {
    setPreview(null);
    setHint(null);
    const res = await playMove(start, events, {
      layout,
      me,
      speed,
      render: (f) => flushSync(() => setFrame(f)),
      fx: () => fxRef.current,
      cancelled: () => !alive.current,
    });
    if (!alive.current) return null;
    setFrame(null);
    return res.hl;
  }

  function finish(next: GameState, events: readonly MoveEvent[]) {
    if (next.status === 'playing') return;
    const pi = player === 'white' ? 0 : 1;
    const outcome: Outcome =
      next.status === 'draw' ? 'draw' : next.status === `${player}_won` ? 'win' : 'loss';
    const reason: OverReason = events.some((e) => e.type === 'collect') ? 'noMoves' : '82';
    setOver({ outcome, reason, my: next.kazans[pi], their: next.kazans[pi === 0 ? 1 : 0] });
  }

  async function move(pit: Pit) {
    if (busy || isOver || st.status !== 'playing') return;
    const mv = applyMove(st, pit);
    ply.current += 1;
    if (mv.record.side === player) history.current.push({ st, hl, moves });
    setMoved(true);
    const nextHl = await run(mv.events, st);
    if (!nextHl) return;
    setSt(mv.state);
    setHl(nextHl);
    setMoves((m) => addMove(m, mv.record.side, formatMove(mv.record)));
    finish(mv.state, mv.events);
    if (p.vibrate) navigator.vibrate?.(mv.record.capture || mv.record.tuzdyk ? [20, 40, 20] : 15);
    if (p.hotSeat && p.autoFlip && mv.state.status === 'playing') setMe(mv.state.turn);
  }

  // Bot reply.
  const { bot } = p;
  useEffect(() => {
    if (!bot || busy || isOver || p.hotSeat || st.status !== 'playing' || st.turn === player)
      return;
    // The reply comes no sooner than BOT_DELAY, so a quick bot does not look instant.
    let cancelled = false;
    const delay = new Promise((resolve) => setTimeout(resolve, BOT_DELAY));
    void Promise.all([bot(st), delay]).then(([pit]) => {
      if (!cancelled && pit !== null) void move(pit);
    });
    return () => {
      cancelled = true;
    };
  }, [st, busy, isOver]);

  // Online: play the server's moves that are not on the board yet (the opponent's, or ours from another tab).
  const { online } = p;
  useEffect(() => {
    if (!online || busy || isOver || st.status !== 'playing') return;
    const pit = online.moves[ply.current];
    if (pit !== undefined) void move(pit);
  }, [online?.moves, busy, st]);

  // Online: the server ended the game; wait for the last move's animation.
  useEffect(() => {
    if (online?.over && !busy) setOver((o) => o ?? online.over);
  }, [online?.over, busy]);

  function onPit(i: number) {
    if (!p.hotSeat && st.turn !== me) return;
    const pit = (i % 9) + 1;
    if (online) {
      if (busy || isOver) return;
      online.send(pit, ply.current);
    }
    void move(pit);
  }

  function undo() {
    if (busy || isOver) return;
    const snap = history.current.pop();
    if (!snap) return;
    setSt(snap.st);
    setHl(snap.hl);
    setMoves(snap.moves);
    setHint(null);
  }

  function showHint() {
    if (busy || isOver || st.turn !== player || !p.hintMove) return;
    const at = st;
    void p.hintMove(at).then((pit) => {
      if (pit !== null && alive.current && stRef.current === at)
        setHint((player === 'white' ? 0 : 9) + pit - 1);
    });
  }

  function confirmResign() {
    setResign(false);
    if (p.onResign) return p.onResign();
    const pi = player === 'white' ? 0 : 1;
    setOver({
      outcome: 'loss',
      reason: 'resign',
      my: st.kazans[pi],
      their: st.kazans[pi === 0 ? 1 : 0],
    });
  }

  async function playDemo() {
    if (busy) return;
    setMe('white');
    const start = fixture('start');
    setSt(start);
    setHl({ lastFrom: null, lastTo: null });
    setMoves([]);
    const nextHl = await run(p.devbar ?? [], start);
    if (!nextHl) return;
    setSt({ ...applyMove(start, 9).state });
    setHl(nextHl);
    setMoves([['9x']]);
  }

  // Board options.
  let boardProps;
  if (frame) {
    boardProps = {
      state: frame.state,
      interactive: false,
      lastFrom: frame.hl.lastFrom,
      lastTo: frame.hl.lastTo,
      capture: frame.capture ?? null,
      pitClass: frame.pitClass ?? {},
      kazanClass: frame.kazanClass ?? {},
    };
  } else {
    const designPreview =
      ui === 'preview' && !moved
        ? {
            hover: 6,
            ...(() => {
              const pv = previewOf(st, 6, t);
              return { previewTarget: pv.target, previewLabel: pv.label };
            })(),
          }
        : {};
    boardProps = {
      state: st,
      interactive: !isOver,
      actor: p.hotSeat ? st.turn : me,
      lastFrom: hl.lastFrom,
      lastTo: hl.lastTo,
      hint,
      previewTarget: preview?.target ?? null,
      previewLabel: preview?.label ?? '',
      ...designPreview,
    };
  }

  const noClock = !p.clocks;
  const clockMe = p.clocks?.me ?? '';
  const clockOpp = p.clocks?.opponent ?? '';
  const clockCls = (running: boolean, low = false) =>
    ['k-clock', running && 'k-clock--running', low && 'k-clock--low'].filter(Boolean).join(' ');
  const modeOn = (...modes: GameMode[]) => modes.includes(p.mode);
  const oppOffline = ui === 'opponent-offline' || !!online?.offline;
  const lowTime = ui === 'low-time' || !!online?.lowTime;
  // 81 : 81 is shown for a draw on the board, not for an agreed or cancelled game.
  const evenScore =
    over?.outcome === 'draw' && over.reason !== 'agreed' && over.reason !== 'cancelled';
  const overText = !over
    ? ''
    : over.reason === 'agreed' || over.reason === 'cancelled'
      ? t(`over.reason.${over.reason}`)
      : t(over.outcome === 'draw' ? 'over.reason.draw' : `over.reason.${over.reason}`);

  const game = (
    <section
      className="k-screen k-game"
      data-screen="game"
      data-component="GameScreen"
      hidden={settingsOpen}
    >
      <TopBar
        title={p.title}
        end={
          <button
            className="k-icon-button"
            aria-label="Settings"
            onClick={env.settings ? openSettings : go('settings')}
          >
            <Settings />
          </button>
        }
      />
      <div className="k-game__body">
        <div className="k-game__main">
          {oppOffline && (
            <div className="k-banner" data-component="Banner">
              <WifiOff />
              <span className="k-banner__text">{t('game.opponentLeft')}</span>
              <span className="k-banner__timer">{online?.offline?.timer ?? '0:45'}</span>
            </div>
          )}
          <PlayerPlate
            who="opponent"
            person={plateOf(opp)}
            side={opp}
            active={oppTurn}
            offline={oppOffline}
            noClock={noClock}
            clock={clockOpp}
            clockClass={clockCls(oppTurn && !oppOffline)}
            t={t}
          />
          <div className="k-game__board">
            <div className="k-board-host" data-board-host="game">
              <BoardHost
                {...boardProps}
                layout={layout}
                me={me}
                uid="game"
                onPit={onPit}
                onPitHover={(i) => setPreview(i === null || busy ? null : previewOf(st, i, t))}
                fxRef={fxRef}
              />
            </div>
          </div>
          <PlayerPlate
            who="me"
            person={plateOf(me)}
            side={me}
            active={mine}
            offline={false}
            noClock={noClock}
            clock={clockMe}
            clockClass={clockCls(mine, lowTime)}
            t={t}
          />
        </div>
        <aside className="k-game__side">
          <section className="k-moves" data-component="MoveList">
            <button className="k-moves__strip" onClick={() => setSheet(true)}>
              <List />
              <span className="k-moves__strip-text">{strip(moves, t)}</span>
              <ChevronUp />
            </button>
            <div className="k-moves__header">{t('game.moves')}</div>
            <div className="k-moves__list" ref={listRef}>
              <MoveRows moves={moves} t={t} />
            </div>
          </section>
          <div className="k-game__actions" data-component="GameActions">
            {modeOn('bot') && (
              <Action
                icon={<Undo2 />}
                long={t('game.undo')}
                short={t('game.undoShort')}
                onClick={undo}
              />
            )}
            {modeOn('bot') && (
              <Action
                icon={<Lightbulb />}
                long={t('game.hint')}
                short={t('game.hint')}
                onClick={showHint}
              />
            )}
            {modeOn('online', 'friend') && (
              <Action
                icon={<Handshake />}
                long={t('game.offerDraw')}
                short={t('game.drawShort')}
                onClick={() => !isOver && online?.onOfferDraw()}
              />
            )}
            <Action
              icon={<ArrowUpDown />}
              long={t('game.flip')}
              short={t('game.flipShort')}
              onClick={() => setMe((m) => (m === 'white' ? 'black' : 'white'))}
            />
            <Action
              icon={<Flag />}
              long={t('game.resign')}
              short={t('game.resign')}
              danger
              onClick={() => !isOver && setResign(true)}
            />
          </div>
        </aside>
      </div>

      {(ui === 'reconnecting' || online?.reconnecting) && (
        <div className="k-overlay" data-component="ReconnectOverlay">
          <span className="k-spinner k-spinner--lg"></span>
          <div className="k-overlay__title">{t('game.reconnecting')}</div>
          <div className="k-overlay__sub">{t('game.reconnectingSub')}</div>
        </div>
      )}

      {sheet && (
        <>
          <div className="k-scrim" onClick={() => setSheet(false)}></div>
          <div className="k-sheet" data-component="Sheet">
            <div className="k-sheet__handle"></div>
            <div className="k-sheet__header">
              <span className="k-sheet__title">{t('game.moves')}</span>
              <button className="k-icon-button" aria-label="Close" onClick={() => setSheet(false)}>
                <X />
              </button>
            </div>
            <div className="k-sheet__body">
              <MoveRows moves={moves} t={t} />
            </div>
          </div>
        </>
      )}

      {resign && (
        <div className="k-modal" data-component="Modal">
          <div className="k-modal__card" role="dialog" aria-modal="true">
            <div className="k-modal__icon">
              <Flag />
            </div>
            <h2 className="k-modal__title">{t('game.resignTitle')}</h2>
            <p className="k-modal__text">{t('game.resignText')}</p>
            <div className="k-modal__actions">
              <button
                className="k-button k-button--primary k-button--block"
                onClick={confirmResign}
              >
                <span>{t('game.resignConfirm')}</span>
              </button>
              <button className="k-button k-button--block" onClick={() => setResign(false)}>
                <span>{t('common.cancel')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {online?.drawOffered && !isOver && !resign && (
        <div className="k-modal" data-component="Modal">
          <div className="k-modal__card" role="dialog" aria-modal="true">
            <div className="k-modal__icon">
              <Handshake />
            </div>
            <h2 className="k-modal__title">{t('game.drawOfferTitle')}</h2>
            <div className="k-modal__actions">
              <button
                className="k-button k-button--primary k-button--block"
                onClick={() => online.onAnswerDraw(true)}
              >
                <span>{t('game.drawAccept')}</span>
              </button>
              <button
                className="k-button k-button--block"
                onClick={() => online.onAnswerDraw(false)}
              >
                <span>{t('game.drawDecline')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {over && (
        <div
          className={`k-modal k-modal--result k-modal--${over.outcome}`}
          data-component="GameOverModal"
        >
          <div className="k-modal__card" role="dialog" aria-modal="true">
            <Ornament className="k-modal__mark" />
            <h2 className="k-modal__title">
              {t(over.reason === 'cancelled' ? 'over.cancelled' : `over.${over.outcome}`)}
            </h2>
            <p className="k-modal__text">{overText}</p>
            <div className="k-score" data-component="Score">
              <div className="k-score__player">
                <span className="k-avatar k-avatar--light">
                  <AvatarContent person={p.players.me} />
                </span>
                <span className="k-score__name">{p.players.me.name}</span>
              </div>
              <div className="k-score__value">
                <span>{evenScore ? 81 : over.my}</span>
                <span className="k-score__sep">:</span>
                <span>{evenScore ? 81 : over.their}</span>
              </div>
              <div className="k-score__player">
                <span className="k-avatar">
                  <AvatarContent person={p.players.opponent} />
                </span>
                <span className="k-score__name">{p.players.opponent.name}</span>
              </div>
            </div>
            <div className="k-modal__actions">
              <button className="k-button k-button--primary k-button--block" onClick={p.onRematch}>
                <RotateCcw />
                <span>{t('over.rematch')}</span>
              </button>
              <button className="k-button k-button--block" onClick={go('home')}>
                <span>{t('over.newGame')}</span>
              </button>
              <button className="k-button k-button--ghost k-button--block" onClick={go('home')}>
                <span>{t('over.home')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {p.devbar && !env.isStatic && (
        <div className="k-devbar" data-component="DevBar">
          <button
            className="k-button k-button--primary k-button--sm"
            onClick={() => void playDemo()}
          >
            <Play />
            <span>{t('game.playMove')}</span>
          </button>
          <select
            className="k-devbar__select"
            aria-label="Speed"
            value={devSpeed}
            onChange={(e) => setDevSpeed(e.target.value as Speed)}
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {t(`settings.speed${s[0]?.toUpperCase()}${s.slice(1)}`)}
              </option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
  if (!settingsOpen || !env.settings) return game;
  return (
    <>
      {game}
      {env.settings(() => window.history.back())}
    </>
  );
}

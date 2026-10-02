/* A game with a friend over the server: /g/<code>. The creator waits here for the friend,
   then both play on the same GameScreen as offline modes, fed by the server. */
import { applyMove, formatMove, initialState, type GameState, type Side } from '@korgool/engine';
import type { GameOver as ServerOver, GameSnapshot } from '@korgool/protocol';
import { useEffect, useState } from 'react';
import { TopBar, useGo, type Person } from '../components/ui';
import type { MovePair } from '../game/fixtures';
import { useT } from '../i18n';
import { formatClock, timeControlLabel, useOnlineGame, type OnlineGame } from '../net/online';
import { FriendWaitScreen } from './FriendScreens';
import { GameScreen, type GameOver, type OverReason } from './GameScreen';

const LOW_TIME_MS = 20_000;
const DISCONNECT_MS = 60_000;

/** Position and move list after the given moves. */
function replayGame(pits: readonly number[]): { state: GameState; moves: MovePair[] } {
  let state = initialState();
  const moves: MovePair[] = [];
  for (const pit of pits) {
    const mv = applyMove(state, pit);
    const note = formatMove(mv.record);
    if (mv.record.side === 'white') moves.push([note]);
    else {
      const last = moves[moves.length - 1];
      if (last && last[1] === undefined) last[1] = note;
      else moves.push(['', note]);
    }
    state = mv.state;
  }
  return { state, moves };
}

/** Server result → the result modal, from the player's side. */
function toOver(o: ServerOver, state: GameState, me: Side): GameOver {
  const pi = me === 'white' ? 0 : 1;
  const my = state.kazans[pi];
  const their = state.kazans[pi === 0 ? 1 : 0];
  if (o.result === 'cancelled') return { outcome: 'draw', reason: 'cancelled', my, their };
  if (o.result === 'draw')
    return { outcome: 'draw', reason: o.reason === 'draw_agreed' ? 'agreed' : '82', my, their };
  const reason: OverReason = {
    score: Math.max(...state.kazans) >= 82 ? '82' : 'noMoves',
    resign: 'resign',
    timeout: 'time',
    disconnect: 'disconnect',
    draw_agreed: 'agreed',
    no_first_move: 'cancelled',
  }[o.reason] as OverReason;
  return { outcome: o.result === `${me}_won` ? 'win' : 'loss', reason, my, their };
}

/** Re-render every `ms` while `on` (clocks, countdowns). */
function useTicker(on: boolean, ms = 250): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setNow(performance.now()), ms);
    return () => clearInterval(id);
  }, [on, ms]);
  return now;
}

function Message({ text }: { text: string }) {
  const t = useT();
  const go = useGo();
  return (
    <section className="k-screen" data-screen="online-message">
      <TopBar />
      <main className="k-page">
        <h1 className="k-page__title">{text}</h1>
        <div className="k-page__footer">
          <button className="k-button k-button--primary k-button--block" onClick={go('home')}>
            <span>{t('over.home')}</span>
          </button>
        </div>
      </main>
    </section>
  );
}

export function OnlineGameScreen({ gameId }: { gameId: string }) {
  const t = useT();
  const online = useOnlineGame(gameId);
  const { game, error } = online;

  if (error)
    return (
      <Message
        text={t(
          error === 'game_full'
            ? 'online.full'
            : error === 'not_found' || error === 'invalid_payload'
              ? 'online.notFound'
              : 'online.error',
        )}
      />
    );

  if (!game)
    return (
      <section className="k-screen" data-screen="online-loading">
        <TopBar />
        <main className="k-page">
          <div className="k-waiting">
            <span className="k-spinner"></span>
            <span>{t('game.reconnecting')}</span>
          </div>
        </main>
      </section>
    );

  const time = timeControlLabel(game.timeControl);
  if (game.phase === 'waiting') {
    const url = `${location.origin}/g/${game.gameId}`;
    return (
      <FriendWaitScreen
        roomCode={game.gameId}
        inviteLink={url.replace(/^https?:\/\//, '')}
        inviteUrl={url}
        time={time ?? 'none'}
        side={game.you ?? 'white'}
      />
    );
  }

  return <OnlineBoard key={`${gameId}-${online.resync}`} online={online} game={game} />;
}

function OnlineBoard({ online, game }: { online: OnlineGame; game: GameSnapshot }) {
  const t = useT();
  const go = useGo();
  // The board starts from the moves known at mount; later moves are played on it one by one.
  const [start] = useState(() => ({ ply: game.moves.length, ...replayGame(game.moves) }));
  const me: Side = game.you ?? 'white';
  const opp: Side = me === 'white' ? 'black' : 'white';
  const ticking =
    game.phase === 'playing' && (!!game.clocks?.running || online.opponentOfflineSince !== null);
  const now = useTicker(ticking);

  const left = (side: Side) => {
    const c = game.clocks;
    if (!c) return 0;
    return c[side] - (c.running === side ? now - online.clocksAt : 0);
  };
  const person = (side: Side): Person => {
    const name = game.players[side]?.name ?? t(`common.${side}`);
    return { name, initial: name.replace(/^Гость_/, '').slice(0, 1) };
  };
  const time = timeControlLabel(game.timeControl);
  const since = online.opponentOfflineSince;
  const queue = game.kind === 'queue';

  return (
    <GameScreen
      mode={queue ? 'online' : 'friend'}
      title={`${t(queue ? 'game.modeOnline' : 'game.modeFriend')}${time ? ` · ${time}` : ''}`}
      initial={start.state}
      moves={start.moves}
      me={me}
      players={{ me: person(me), opponent: person(opp) }}
      clocks={game.clocks ? { me: formatClock(left(me)), opponent: formatClock(left(opp)) } : null}
      onResign={online.resign}
      onRematch={go(queue ? 'matchmaking' : 'friend-create')}
      online={{
        moves: game.moves,
        startPly: start.ply,
        send: online.move,
        over: online.over ? toOver(online.over, game.state, me) : null,
        offline:
          since !== null && game.phase === 'playing'
            ? { timer: formatClock(DISCONNECT_MS - (now - since)) }
            : null,
        reconnecting: !online.connected,
        lowTime: !!game.clocks && game.clocks.running === me && left(me) < LOW_TIME_MS,
        drawOffered: game.drawOffer === opp,
        onOfferDraw: online.offerDraw,
        onAnswerDraw: online.answerDraw,
      }}
    />
  );
}

/* /__design?screen=…&fixture=…&state=…&static=1 — the handoff screens rendered by the real components
   from the same fixtures (port of the URL handling in design/handoff/app.js). Dev only. */
import { useEffect, useMemo, type ReactNode } from 'react';
import { AppContext, type AppEnv, type Params, type ScreenId } from '../app';
import { SPEEDS, type Speed } from '../board/motion';
import { Sprite } from '../board/Sprite';
import { DATA, fixture, isFixture, type FixtureId } from '../game/fixtures';
import { isLang, setLang, useT, type Lang } from '../i18n';
import { BotSetupScreen } from '../screens/BotSetupScreen';
import { FriendCreateScreen, FriendWaitScreen, JoinCodeScreen } from '../screens/FriendScreens';
import {
  GAME_MODES,
  GameScreen,
  type GameMode,
  type GameUiState,
  type Outcome,
  type OverReason,
} from '../screens/GameScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MatchmakingScreen } from '../screens/MatchmakingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RulesScreen } from '../screens/RulesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SpecScreen } from '../screens/SpecScreen';
import { TutorialScreen } from '../screens/TutorialScreen';
import { storedSpeed } from '../settings';

const SCREENS: readonly ScreenId[] = [
  'home',
  'bot-setup',
  'friend-create',
  'friend-wait',
  'join-code',
  'matchmaking',
  'matchmaking-offer-bot',
  'game',
  'game-over',
  'sign-in',
  'profile',
  'rules',
  'tutorial',
  'settings',
  'spec',
];
const UI_STATES: readonly GameUiState[] = [
  'my-turn',
  'opponent-turn',
  'preview',
  'low-time',
  'reconnecting',
  'opponent-offline',
  'resign-confirm',
  'history-open',
];
const OUTCOMES: readonly Outcome[] = ['win', 'loss', 'draw'];
const REASONS: readonly OverReason[] = ['82', 'noMoves', 'time', 'resign', 'disconnect'];

function readParams() {
  const Q = new URLSearchParams(location.search);
  const lang = Q.get('lang');
  const mode = Q.get('mode');
  const screen = Q.get('screen');
  return {
    screen: (SCREENS as readonly string[]).includes(screen ?? '') ? (screen as ScreenId) : 'home',
    fixture: Q.get('fixture'),
    state: Q.get('state') ?? 'my-turn',
    static: Q.get('static') === '1',
    lang: (isLang(lang) ? lang : 'ru') as Lang,
    mode: (GAME_MODES.find((m) => m === mode) ?? 'online') as GameMode,
    outcome: OUTCOMES.find((o) => o === Q.get('outcome')) ?? null,
    reason: REASONS.find((r) => r === Q.get('reason')) ?? '82',
    auth: Q.get('auth') === '1' || Q.get('state') === 'signed-in',
  };
}

function designHref(P: ReturnType<typeof readParams>, screen: ScreenId, params?: Params): string {
  const q = new URLSearchParams(params ?? {});
  q.set('screen', screen);
  if (P.lang !== 'ru') q.set('lang', P.lang);
  if (P.auth) q.set('auth', '1');
  return '/__design?' + q.toString();
}

function setUrlParam(key: string, value: string) {
  const q = new URLSearchParams(location.search);
  q.set(key, value);
  location.search = q.toString();
}

function DesignGame({ P }: { P: ReturnType<typeof readParams> }) {
  const t = useT();
  const isOver = P.screen === 'game-over';
  const fx: FixtureId = isFixture(P.fixture) ? P.fixture : isOver ? 'gameover' : 'midgame';
  const st = fixture(fx);
  const ui: GameUiState = isOver ? 'my-turn' : (UI_STATES.find((s) => s === P.state) ?? 'my-turn');
  const opp = P.mode === 'bot' ? DATA.bot : DATA.opponent;
  const title = {
    online: t('game.modeOnline') + ' · ' + DATA.time.online,
    bot: t('game.modeBot') + ' · ' + t('bot.level4'),
    friend: t('game.modeFriend') + ' · ' + DATA.time.friend,
    local: t('game.modeLocal'),
  }[P.mode];
  let over = null;
  if (isOver) {
    const my = st.kazans[0],
      their = st.kazans[1];
    const outcome: Outcome =
      P.outcome ??
      (my > 81 ? 'win' : their > 81 ? 'loss' : my === 81 && their === 81 ? 'draw' : 'win');
    over = { outcome, reason: P.reason, my, their };
  }
  const go = (screen: ScreenId, params?: Params) => location.assign(designHref(P, screen, params));
  return (
    <GameScreen
      mode={P.mode}
      title={title}
      initial={st}
      highlight={fx === 'midgame' ? DATA.midgameHighlight : { lastFrom: null, lastTo: null }}
      moves={fx === 'start' ? [] : DATA.moves}
      players={{ me: DATA.me, opponent: opp }}
      clocks={
        P.mode === 'bot'
          ? null
          : {
              me: ui === 'low-time' ? DATA.clocks.low : DATA.clocks.me,
              opponent: DATA.clocks.opponent,
            }
      }
      uiState={ui}
      over={over}
      onResign={() => go('game-over', { mode: P.mode, outcome: 'loss', reason: 'resign' })}
      onRematch={() => go('game', { mode: P.mode, fixture: 'start' })}
      devbar={DATA.demoEvents}
    />
  );
}

export default function DesignRoute() {
  const P = useMemo(readParams, []);
  useMemo(() => setLang(P.lang), [P.lang]);
  const speed: Speed = storedSpeed();
  const env = useMemo<AppEnv>(
    () => ({
      go: (screen, params) => location.assign(designHref(P, screen, params)),
      href: (screen, params) => designHref(P, screen, params),
      isStatic: P.static,
      speed,
    }),
    [P, speed],
  );
  useEffect(() => {
    document.documentElement.classList.toggle('k-static', P.static);
    document.documentElement.dataset.ready = '1';
  }, [P.static]);

  let screen: ReactNode;
  switch (P.screen) {
    case 'home':
      screen = (
        <HomeScreen signedIn={P.auth} lang={P.lang} onLang={(l) => setUrlParam('lang', l)} />
      );
      break;
    case 'bot-setup':
      screen = <BotSetupScreen />;
      break;
    case 'friend-create':
      screen = <FriendCreateScreen />;
      break;
    case 'friend-wait':
      screen = <FriendWaitScreen roomCode={DATA.roomCode} inviteLink={DATA.inviteLink} />;
      break;
    case 'join-code':
      screen = <JoinCodeScreen prefill={DATA.joinPrefill} />;
      break;
    case 'matchmaking':
    case 'matchmaking-offer-bot':
      screen = <MatchmakingScreen startSeconds={P.screen === 'matchmaking-offer-bot' ? 31 : 12} />;
      break;
    case 'game':
    case 'game-over':
      screen = <DesignGame P={P} />;
      break;
    case 'sign-in':
      screen = <SignInScreen />;
      break;
    case 'profile':
      screen = <ProfileScreen data={{ ...DATA.me, stats: DATA.stats, history: DATA.history }} />;
      break;
    case 'rules':
      screen = <RulesScreen />;
      break;
    case 'tutorial':
      screen = <TutorialScreen />;
      break;
    case 'settings':
      screen = (
        <SettingsScreen
          lang={P.lang}
          onLang={(l) => setUrlParam('lang', l)}
          speed={speed}
          onSpeed={(s) => {
            if (SPEEDS.includes(s)) localStorage.setItem('k.speed', s);
          }}
        />
      );
      break;
    case 'spec':
      screen = <SpecScreen />;
      break;
  }
  return (
    <AppContext.Provider value={env}>
      <Sprite />
      <div className="k-app" id="app">
        {screen}
      </div>
    </AppContext.Provider>
  );
}

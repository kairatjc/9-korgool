/* Real app routes (TanStack Router). Screens are the same components the /__design route renders. */
import type { Side } from '@korgool/engine';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useSearch,
} from '@tanstack/react-router';
import { createContext, useContext, useMemo, useState } from 'react';
import { AppContext, useApp, type AppEnv, type Params, type ScreenId } from './app';
import { Sprite } from './board/Sprite';
import type { SideKind } from './components/ui';
import { botMove, isBotLevel, type BotLevel } from './game/bot';
import { DATA, fixture } from './game/fixtures';
import { useT } from './i18n';
import { BotSetupScreen } from './screens/BotSetupScreen';
import { FriendCreateScreen, FriendWaitScreen, JoinCodeScreen } from './screens/FriendScreens';
import { GAME_MODES, GameScreen, type GameMode } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { MatchmakingScreen } from './screens/MatchmakingScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RulesScreen } from './screens/RulesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SignInScreen } from './screens/SignInScreen';
import { TutorialScreen } from './screens/TutorialScreen';
import { useSettings } from './settings';

const PATHS: Record<ScreenId, string> = {
  home: '/',
  'bot-setup': '/bot',
  'friend-create': '/friend',
  'friend-wait': '/friend/wait',
  'join-code': '/join',
  matchmaking: '/play',
  'matchmaking-offer-bot': '/play',
  game: '/game',
  'game-over': '/game',
  'sign-in': '/sign-in',
  profile: '/profile',
  rules: '/rules',
  tutorial: '/tutorial',
  settings: '/settings',
  spec: '/',
};

type Settings = ReturnType<typeof useSettings>;
const SettingsContext = createContext<Settings | null>(null);
function useAppSettings(): Settings {
  const s = useContext(SettingsContext);
  if (!s) throw new Error('SettingsContext is missing');
  return s;
}

/** Search params are kept as plain strings. */
const strings = (search: Record<string, unknown>): Params =>
  Object.fromEntries(
    Object.entries(search)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)]),
  );

function Root() {
  const settings = useSettings();
  const navigate = useNavigate();
  const env = useMemo<AppEnv>(
    () => ({
      go: (screen, params) => {
        // `fixture` / `state` only make sense for the design fixtures.
        const search = Object.fromEntries(
          Object.entries(params ?? {}).filter(([k]) => k !== 'fixture' && k !== 'state'),
        );
        void navigate({ to: PATHS[screen], search });
      },
      href: (screen, params) => {
        const q = new URLSearchParams(params).toString();
        return PATHS[screen] + (q ? '?' + q : '');
      },
      isStatic: false,
      speed: settings.speed,
    }),
    [navigate, settings.speed],
  );
  return (
    <SettingsContext.Provider value={settings}>
      <AppContext.Provider value={env}>
        <Sprite />
        <div className="k-app" id="app">
          <Outlet />
        </div>
      </AppContext.Provider>
    </SettingsContext.Provider>
  );
}

const rootRoute = createRootRoute({ component: Root, validateSearch: strings });

const page = (path: string, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

function Home() {
  const s = useAppSettings();
  return <HomeScreen signedIn={false} lang={s.lang} onLang={s.setLang} />;
}

function FriendWait() {
  const search = useSearch({ strict: false }) as Params;
  const side = (['white', 'black', 'random'] as const).find((v) => v === search.side) ?? 'white';
  // TODO: a real room from the server; the code is a placeholder until then.
  return (
    <FriendWaitScreen
      roomCode={DATA.roomCode}
      inviteLink={DATA.inviteLink}
      time={search.time ?? '10+5'}
      side={side}
    />
  );
}

function Settings() {
  const s = useAppSettings();
  return (
    <SettingsScreen
      lang={s.lang}
      onLang={s.setLang}
      speed={s.speed}
      onSpeed={s.setSpeed}
      prefs={s.prefs}
      onPrefs={s.setPrefs}
    />
  );
}

function resolveSide(v: string | undefined): Side {
  const kind: SideKind = v === 'black' || v === 'random' ? v : 'white';
  if (kind === 'random') return Math.random() < 0.5 ? 'white' : 'black';
  return kind;
}

function Game() {
  const t = useT();
  const { go } = useApp();
  const settings = useAppSettings();
  const search = useSearch({ strict: false }) as Params;
  const mode: GameMode = GAME_MODES.find((m) => m === search.mode) ?? 'local';
  const levelN = Number(search.level ?? 2);
  const level: BotLevel = isBotLevel(levelN) ? levelN : 2;
  const [me] = useState<Side>(() => (mode === 'bot' ? resolveSide(search.side) : 'white'));
  const nonce = search.n ?? '0';
  const hotSeat = mode !== 'bot';
  const sideName = (s: Side) => t(`common.${s}`);
  const opp: Side = me === 'white' ? 'black' : 'white';
  const title = {
    online: `${t('game.modeOnline')} · ${DATA.time.online}`,
    bot: `${t('game.modeBot')} · ${t(`bot.level${level}`)}`,
    friend: t('game.modeFriend'),
    local: t('game.modeLocal'),
  }[mode];
  const players = {
    me: { name: sideName(me), initial: sideName(me).slice(0, 1) },
    opponent:
      mode === 'bot'
        ? { name: t(`bot.level${level}`), icon: 'bot' as const }
        : { name: sideName(opp), initial: sideName(opp).slice(0, 1) },
  };
  return (
    <GameScreen
      key={`${mode}-${nonce}`}
      mode={mode}
      title={title}
      initial={fixture('start')}
      me={me}
      players={players}
      clocks={null}
      hotSeat={hotSeat}
      autoFlip={settings.prefs.flip}
      vibrate={settings.prefs.vibration}
      bot={mode === 'bot' ? (s) => botMove(s, level) : undefined}
      hintMove={(s) => botMove(s, 4)}
      onRematch={() => go('game', { ...search, n: String(Number(nonce) + 1) })}
    />
  );
}

const routes = [
  page('/', Home),
  page('/bot', BotSetupScreen),
  page('/friend', FriendCreateScreen),
  page('/friend/wait', FriendWait),
  page('/join', () => <JoinCodeScreen />),
  page('/play', () => <MatchmakingScreen />),
  page('/game', Game),
  page('/sign-in', SignInScreen),
  page('/profile', () => (
    // TODO: real profile once accounts exist; the design's sample data until then.
    <ProfileScreen data={{ ...DATA.me, stats: DATA.stats, history: DATA.history }} />
  )),
  page('/rules', RulesScreen),
  page('/tutorial', TutorialScreen),
  page('/settings', Settings),
];

export const router = createRouter({ routeTree: rootRoute.addChildren(routes) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

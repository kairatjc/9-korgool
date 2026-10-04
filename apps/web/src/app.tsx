/* App-wide context shared by the real routes and the dev-only /__design route:
   navigation between screens, the static flag (no animations, frozen timers) and the playback speed. */
import { createContext, useContext, type ReactNode } from 'react';
import type { Speed } from './board/motion';

export type ScreenId =
  | 'home'
  | 'bot-setup'
  | 'friend-create'
  | 'friend-wait'
  | 'join-code'
  | 'matchmaking'
  | 'matchmaking-offer-bot'
  | 'game'
  | 'game-over'
  | 'sign-in'
  | 'profile'
  | 'rules'
  | 'tutorial'
  | 'settings'
  | 'spec';

export type Params = Record<string, string>;

export interface AppEnv {
  go: (screen: ScreenId, params?: Params) => void;
  href: (screen: ScreenId, params?: Params) => string;
  /** `static=1`: animations off, move playback instant, timers frozen. */
  isStatic: boolean;
  speed: Speed;
  /** Settings opened from a running game: drawn by the game screen in place of itself, so the game
      (its position, bot, online connection) stays alive. Without it the button opens /settings. */
  settings?: (close: () => void) => ReactNode;
}

export const AppContext = createContext<AppEnv | null>(null);

export function useApp(): AppEnv {
  const env = useContext(AppContext);
  if (!env) throw new Error('AppContext is missing');
  return env;
}

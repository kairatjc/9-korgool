/* Tutorial steps (docs/gameplay-and-features.md §5: sowing, capture, tuzdyk, end of the game).
   Only step 2 is drawn in the handoff; the others reuse its CoachMark and board. */
import { initialState, parse, type GameState } from '@korgool/engine';

export interface TutorialStep {
  /** Position, rules.md §7 notation; the player is always White. */
  position: string | null;
  /** Board index of the only pit that may be tapped; `null` — nothing to tap, just «Далее». */
  pit: number | null;
  title: string;
  text: string;
  /** Text shown after the move. */
  done?: string;
}

export const STEPS: readonly TutorialStep[] = [
  { position: null, pit: null, title: 'tutorial.boardTitle', text: 'tutorial.boardText' },
  {
    position: null,
    pit: 6,
    title: 'tutorial.tapPit',
    text: 'tutorial.tapPitSub',
    done: 'tutorial.sowDone',
  },
  {
    // Pit 4 (8 korgools) ends in the opponent's pit 2: 5 → 6, even — a capture.
    position: '3,5,1,8,4,0,2,6,1,7,5,9,1,3,10,2,4,6/42,43/-,-/w',
    pit: 3,
    title: 'tutorial.captureTitle',
    text: 'tutorial.captureText',
    done: 'tutorial.captureDone',
  },
  {
    // Pit 5 (8 korgools) ends in the opponent's pit 3: 2 → 3 — a tuzdyk.
    position: '2,0,6,1,8,3,0,4,7,1,0,2,4,9,1,5,3,8/56,42/-,-/w',
    pit: 4,
    title: 'tutorial.tuzdykTitle',
    text: 'tutorial.tuzdykText',
    done: 'tutorial.tuzdykDone',
  },
  {
    // 76 in the kazan; pit 9 (3 korgools) captures 6 in the opponent's pit 2 — 82, a win.
    position: '1,0,0,2,0,5,1,0,3,2,5,0,1,2,0,3,0,1/76,60/-,-/w',
    pit: 8,
    title: 'tutorial.winTitle',
    text: 'tutorial.winText',
    done: 'tutorial.winDone',
  },
];

export function stepState(step: TutorialStep): GameState {
  return step.position ? parse(step.position) : initialState();
}

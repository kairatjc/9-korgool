/* Client side of the bot: @korgool/engine's chooseMove, run in a Web Worker (bot.worker.ts).
   Falls back to the main thread where workers are unavailable (unit tests) or the worker fails. */
import { chooseMove, type BotLevel, type GameState, type Pit } from '@korgool/engine';

export { BOT_LEVELS, isBotLevel, type BotLevel } from '@korgool/engine';

export interface BotRequest {
  id: number;
  state: GameState;
  level: BotLevel;
}
export interface BotResponse {
  id: number;
  pit: Pit | null;
}

interface Pending {
  resolve: (pit: Pit | null) => void;
  request: BotRequest;
}

let worker: Worker | null = null;
let broken = false;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (worker || broken || typeof Worker === 'undefined') return worker;
  try {
    worker = new Worker(new URL('./bot.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    broken = true;
    return null;
  }
  worker.onmessage = (e: MessageEvent<BotResponse>) => {
    const job = pending.get(e.data.id);
    pending.delete(e.data.id);
    job?.resolve(e.data.pit);
  };
  worker.onerror = () => {
    // The worker could not load or crashed: answer what is waiting on the main thread and stop using it.
    broken = true;
    worker?.terminate();
    worker = null;
    for (const { resolve, request } of pending.values())
      resolve(chooseMove(request.state, request.level));
    pending.clear();
  };
  return worker;
}

/** The bot's move (pit 1..9) for the player to move, or `null` if there is none. */
export function botMove(state: GameState, level: BotLevel): Promise<Pit | null> {
  const w = getWorker();
  if (!w) return Promise.resolve(chooseMove(state, level));
  const request: BotRequest = { id: nextId++, state, level };
  return new Promise((resolve) => {
    pending.set(request.id, { resolve, request });
    w.postMessage(request);
  });
}

/* The bot's search runs here, off the main thread, so the board stays responsive while it thinks. */
import { chooseMove } from '@korgool/engine';
import type { BotRequest, BotResponse } from './bot';

self.onmessage = (e: MessageEvent<BotRequest>) => {
  const { id, state, level } = e.data;
  const response: BotResponse = { id, pit: chooseMove(state, level) };
  self.postMessage(response);
};

import { serialize } from '@korgool/engine';
import type { Db } from './db';
import type { OnlineGame } from './game';
import { games } from './schema';

/** Записать законченную партию в PostgreSQL (таблица `games`). */
export async function saveFinishedGame(db: Db, game: OnlineGame, endedAt: number): Promise<void> {
  if (!game.result || !game.reason) throw new Error(`game ${game.id} is not over`);
  await db.insert(games).values({
    code: game.id,
    kind: game.kind,
    whiteId: game.seats.white?.id ?? null,
    blackId: game.seats.black?.id ?? null,
    initialSeconds: game.timeControl?.initial ?? null,
    incrementSeconds: game.timeControl?.increment ?? null,
    result: game.result,
    reason: game.reason,
    moves: game.moves.join(' '),
    finalPosition: serialize(game.state),
    startedAt: new Date(game.startedAt ?? endedAt),
    endedAt: new Date(endedAt),
  });
}

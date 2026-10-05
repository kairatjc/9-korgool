import { createClient } from 'redis';
import type { SavedGame } from './game';

/** Хранилище активных партий: переживает перезапуск сервера (architecture.md §5). */
export interface GameStore {
  /** `ttlMs` — через сколько удалить запись; null — хранить, пока партию не удалят. */
  save(game: SavedGame, ttlMs: number | null): Promise<void>;
  remove(id: string): Promise<void>;
  loadAll(): Promise<SavedGame[]>;
  close(): Promise<void>;
}

/** В памяти процесса: для разработки без Redis и для тестов. */
export class MemoryGameStore implements GameStore {
  readonly games = new Map<string, SavedGame>();

  async save(game: SavedGame): Promise<void> {
    this.games.set(game.id, structuredClone(game));
  }

  async remove(id: string): Promise<void> {
    this.games.delete(id);
  }

  async loadAll(): Promise<SavedGame[]> {
    return [...this.games.values()].map((g) => structuredClone(g));
  }

  async close(): Promise<void> {}
}

const PREFIX = 'game:';
const newClient = (url: string) => createClient({ url });

/** Redis (Valkey): ключ `game:{код}` — JSON партии. */
export class RedisGameStore implements GameStore {
  private constructor(private readonly client: ReturnType<typeof newClient>) {}

  static async connect(url: string): Promise<RedisGameStore> {
    const client = newClient(url);
    await client.connect();
    return new RedisGameStore(client);
  }

  async save(game: SavedGame, ttlMs: number | null): Promise<void> {
    const value = JSON.stringify(game);
    if (ttlMs === null) await this.client.set(PREFIX + game.id, value);
    else
      await this.client.set(PREFIX + game.id, value, { expiration: { type: 'PX', value: ttlMs } });
  }

  async remove(id: string): Promise<void> {
    await this.client.del(PREFIX + id);
  }

  async loadAll(): Promise<SavedGame[]> {
    const games: SavedGame[] = [];
    for await (const keys of this.client.scanIterator({ MATCH: `${PREFIX}*`, COUNT: 500 })) {
      if (keys.length === 0) continue;
      for (const value of await this.client.mGet(keys)) {
        if (value) games.push(JSON.parse(value) as SavedGame);
      }
    }
    return games;
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SavedGame } from '../src/game';
import { RedisGameStore } from '../src/store';

// Нужен настоящий Redis: в CI он поднимается сервисом, локально — `REDIS_URL=redis://localhost:6379`.
const url = process.env['REDIS_URL'];

const saved = (id: string): SavedGame => ({
  id,
  kind: 'friend',
  timeControl: { initial: 300, increment: 3 },
  seats: { white: { id: 'a', name: 'Алиса' }, black: { id: 'b', name: 'Бек' } },
  phase: 'playing',
  moves: [7, 1],
  result: null,
  reason: null,
  drawOffer: null,
  startedAt: 1_000,
  remaining: { white: 290_000, black: 300_000 },
  savedAt: 2_000,
});

describe.skipIf(!url)('хранилище партий в Redis', () => {
  let store: RedisGameStore;
  // Свой код партий, чтобы не задеть чужие ключи в общей базе.
  const ids = ['TST2A1', 'TST2A2'];

  beforeAll(async () => {
    store = await RedisGameStore.connect(url as string);
  });
  afterAll(async () => {
    for (const id of ids) await store.remove(id);
    await store.close();
  });

  it('сохраняет, загружает и удаляет партии', async () => {
    await store.save(saved(ids[0]!), null);
    await store.save(saved(ids[1]!), 60_000);
    const all = await store.loadAll();
    expect(all.filter((g) => ids.includes(g.id))).toHaveLength(2);
    expect(all.find((g) => g.id === ids[0])).toEqual(saved(ids[0]!));

    await store.remove(ids[0]!);
    expect((await store.loadAll()).map((g) => g.id)).not.toContain(ids[0]);
  });

  it('законченная партия удаляется по истечении срока', async () => {
    await store.save({ ...saved(ids[1]!), phase: 'over' }, 50);
    await new Promise((r) => setTimeout(r, 120));
    expect((await store.loadAll()).map((g) => g.id)).not.toContain(ids[1]);
  });
});

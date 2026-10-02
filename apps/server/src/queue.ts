import type { Player } from '@korgool/protocol';

/**
 * Общая FIFO-очередь случайного подбора: первые двое образуют пару (architecture.md §5).
 * Игрок может стоять в очереди из нескольких вкладок; он уходит из неё, когда закрыта последняя.
 * Пока в памяти процесса; позже — список в Redis.
 */
export class Matchmaker {
  private readonly queue: { player: Player; sockets: Set<string> }[] = [];

  get size(): number {
    return this.queue.length;
  }

  /** Встать в очередь. Возвращает пару, если соперник уже ждал. */
  join(player: Player, socketId: string): [Player, Player] | null {
    const own = this.queue.find((e) => e.player.id === player.id);
    if (own) {
      own.sockets.add(socketId);
      return null;
    }
    const opponent = this.queue.shift();
    if (opponent) return [opponent.player, player];
    this.queue.push({ player, sockets: new Set([socketId]) });
    return null;
  }

  leave(playerId: string): void {
    const i = this.queue.findIndex((e) => e.player.id === playerId);
    if (i >= 0) this.queue.splice(i, 1);
  }

  /** Закрылась вкладка: без вкладок игрок уходит из очереди. */
  dropSocket(playerId: string, socketId: string): void {
    const entry = this.queue.find((e) => e.player.id === playerId);
    if (!entry) return;
    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) this.leave(playerId);
  }
}

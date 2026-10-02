import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Player } from '@korgool/protocol';

/** Слова для гостевых ников вида «Гость_Бүркүт42» (gameplay-and-features.md §3). */
const NICK_WORDS = [
  'Бүркүт',
  'Шумкар',
  'Тулпар',
  'Арстан',
  'Карышкыр',
  'Илбирс',
  'Кулан',
  'Марал',
  'Аккуу',
  'Тоо',
  'Ала-Тоо',
  'Нарын',
];

export function guestName(random: (max: number) => number = randomInt): string {
  const word = NICK_WORDS[random(NICK_WORDS.length)];
  return `Гость_${word}${random(90) + 10}`;
}

/**
 * Гостевые сессии в памяти: токен → игрок.
 * Временное решение этапа 2 — позже их заменят сессии Better Auth в PostgreSQL.
 */
export class GuestSessions {
  private readonly byToken = new Map<string, Player>();

  create(): { token: string; player: Player } {
    const token = randomBytes(24).toString('base64url');
    const player = { id: randomUUID(), name: guestName() };
    this.byToken.set(token, player);
    return { token, player };
  }

  get(token: unknown): Player | null {
    return typeof token === 'string' ? (this.byToken.get(token) ?? null) : null;
  }
}

import { randomInt } from 'node:crypto';

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

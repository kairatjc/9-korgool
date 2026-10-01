/** Лунок у каждого игрока. */
export const PITS_PER_SIDE = 9;
/** Всего лунок на доске (кольцевой массив). */
export const BOARD_SIZE = PITS_PER_SIDE * 2;
/** Шариков в каждой лунке в начале партии. */
export const INITIAL_PIT_COUNT = 9;
/** Всего шариков в игре. */
export const TOTAL_KORGOOLS = BOARD_SIZE * INITIAL_PIT_COUNT;
/** Сколько нужно собрать в казане для победы (больше половины). */
export const WIN_THRESHOLD = TOTAL_KORGOOLS / 2 + 1;
/** Счёт, при котором у обоих ничья. */
export const DRAW_SCORE = TOTAL_KORGOOLS / 2;

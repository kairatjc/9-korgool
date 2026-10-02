/**
 * Протокол клиент ↔ сервер (docs/architecture.md §4).
 *
 * Всё, что приходит от клиента, сервер проверяет этими схемами. Сообщения сервера
 * описаны схемами тоже — клиент может проверять их в dev-сборке и в тестах.
 */
import { z } from 'zod';

// ─── Общие типы ──────────────────────────────────────────────────────────────

export const sideSchema = z.enum(['white', 'black']);
export type Side = z.infer<typeof sideSchema>;

/** Код партии: 6 символов без похожих букв и цифр (0/O, 1/I). Он же — код комнаты. */
export const GAME_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const GAME_ID_LENGTH = 6;
export const gameIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(new RegExp(`^[${GAME_ID_ALPHABET}]{${GAME_ID_LENGTH}}$`), 'Неверный код партии');

export const pitSchema = z.number().int().min(1).max(9);

/**
 * Контроль времени «минуты + добавка» в секундах (rules.md §8, добавка по Фишеру).
 * `null` — без часов. Заочная игра (дни на ход) пока не поддерживается.
 */
export const timeControlSchema = z
  .object({
    initial: z
      .number()
      .int()
      .min(60)
      .max(60 * 60),
    increment: z.number().int().min(0).max(60),
  })
  .nullable();
export type TimeControl = z.infer<typeof timeControlSchema>;

/** Пресеты из gameplay-and-features.md §1.4. */
export const TIME_CONTROL_PRESETS = {
  '3+2': { initial: 180, increment: 2 },
  '5+3': { initial: 300, increment: 3 },
  '10+5': { initial: 600, increment: 5 },
  '15+10': { initial: 900, increment: 10 },
} as const satisfies Record<string, NonNullable<TimeControl>>;

/** Случайный подбор: одна общая очередь с фиксированным контролем 5+3 (gameplay-and-features.md §1.2). */
export const QUEUE_TIME_CONTROL = TIME_CONTROL_PRESETS['5+3'];

export const colorChoiceSchema = z.enum(['white', 'black', 'random']);
export type ColorChoice = z.infer<typeof colorChoiceSchema>;

// Состояние и события хода — те же, что в @korgool/engine (типы совпадают структурно).
const countSchema = z.number().int().min(0);
const statusSchema = z.enum(['playing', 'white_won', 'black_won', 'draw']);
const finalStatusSchema = z.enum(['white_won', 'black_won', 'draw']);

export const gameStateSchema = z.object({
  pits: z.array(countSchema).length(18).readonly(),
  kazans: z.tuple([countSchema, countSchema]).readonly(),
  tuzdyks: z.tuple([z.number().int().nullable(), z.number().int().nullable()]).readonly(),
  turn: sideSchema,
  status: statusSchema,
});

export const moveEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pickup'), index: z.number().int(), count: countSchema }),
  z.object({ type: z.literal('sow'), index: z.number().int(), toKazan: sideSchema.nullable() }),
  z.object({
    type: z.literal('capture'),
    index: z.number().int(),
    count: countSchema,
    by: sideSchema,
  }),
  z.object({ type: z.literal('tuzdyk'), index: z.number().int(), by: sideSchema }),
  z.object({ type: z.literal('collect'), side: sideSchema, count: countSchema }),
  z.object({ type: z.literal('game_over'), status: finalStatusSchema }),
]);

/**
 * Часы: остаток каждого игрока в миллисекундах на момент отправки сообщения
 * и чьи часы сейчас идут. Клиент ведёт локальный отсчёт от этих значений.
 */
export const clocksSchema = z.object({
  white: z.number().int().min(0),
  black: z.number().int().min(0),
  running: sideSchema.nullable(),
});
export type Clocks = z.infer<typeof clocksSchema>;

export const playerSchema = z.object({ id: z.string(), name: z.string() });
export type Player = z.infer<typeof playerSchema>;

export const gameResultSchema = z.enum(['white_won', 'black_won', 'draw', 'cancelled']);
export type GameResult = z.infer<typeof gameResultSchema>;

/**
 * Почему партия закончилась:
 * `score` — по правилам (казан, ничья 81:81, нет ходов),
 * `timeout` — флаг, `disconnect` — не вернулся за 60 с,
 * `no_first_move` — первый ход не сделан за 30 с (партия отменена).
 */
export const gameOverReasonSchema = z.enum([
  'score',
  'resign',
  'draw_agreed',
  'timeout',
  'disconnect',
  'no_first_move',
]);
export type GameOverReason = z.infer<typeof gameOverReasonSchema>;

export const gamePhaseSchema = z.enum(['waiting', 'playing', 'over']);

/** Откуда партия: приглашение друга или очередь подбора. */
export const gameKindSchema = z.enum(['friend', 'queue']);
export type GameKind = z.infer<typeof gameKindSchema>;

/** Полное состояние партии: ответ на создание/вход и восстановление после реконнекта. */
export const gameSnapshotSchema = z.object({
  gameId: gameIdSchema,
  kind: gameKindSchema,
  phase: gamePhaseSchema,
  timeControl: timeControlSchema,
  players: z.object({ white: playerSchema.nullable(), black: playerSchema.nullable() }),
  /** За кого играет получатель (`null` — не участник). */
  you: sideSchema.nullable(),
  state: gameStateSchema,
  /** Ходы партии — номера лунок 1..9 по порядку; `moves.length` — номер следующего полухода. */
  moves: z.array(pitSchema),
  clocks: clocksSchema.nullable(),
  drawOffer: sideSchema.nullable(),
  online: z.object({ white: z.boolean(), black: z.boolean() }),
  result: gameResultSchema.nullable(),
  reason: gameOverReasonSchema.nullable(),
});
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

// ─── Клиент → сервер ─────────────────────────────────────────────────────────

export const createGameSchema = z.object({
  timeControl: timeControlSchema,
  color: colorChoiceSchema,
});
export type CreateGamePayload = z.infer<typeof createGameSchema>;

export const gameRefSchema = z.object({ gameId: gameIdSchema });
export type GameRefPayload = z.infer<typeof gameRefSchema>;

export const moveSchema = z.object({
  gameId: gameIdSchema,
  pit: pitSchema,
  /** Номер полухода, который делает игрок (0 — первый ход партии). Защита от дублей. */
  ply: z.number().int().min(0),
});
export type MovePayload = z.infer<typeof moveSchema>;

/** События без данных (`queue:join`, `queue:leave`). */
export const emptySchema = z.object({});
export type EmptyPayload = z.infer<typeof emptySchema>;

export const drawAnswerSchema = z.object({ gameId: gameIdSchema, accept: z.boolean() });
export type DrawAnswerPayload = z.infer<typeof drawAnswerSchema>;

// ─── Сервер → клиент ─────────────────────────────────────────────────────────

/** Гостевая сессия: клиент сохраняет `token` и передаёт его в `auth.token` при подключении. */
export const sessionSchema = z.object({ token: z.string(), player: playerSchema });
export type Session = z.infer<typeof sessionSchema>;

export const gameMovedSchema = z.object({
  gameId: gameIdSchema,
  pit: pitSchema,
  /** Номер сделанного полухода. */
  ply: z.number().int().min(0),
  side: sideSchema,
  events: z.array(moveEventSchema),
  state: gameStateSchema,
  clocks: clocksSchema.nullable(),
});
export type GameMoved = z.infer<typeof gameMovedSchema>;

export const gameOverSchema = z.object({
  gameId: gameIdSchema,
  result: gameResultSchema,
  reason: gameOverReasonSchema,
  clocks: clocksSchema.nullable(),
});
export type GameOver = z.infer<typeof gameOverSchema>;

export const drawOfferedSchema = z.object({ gameId: gameIdSchema, by: sideSchema });
export type DrawOffered = z.infer<typeof drawOfferedSchema>;

export const opponentStatusSchema = z.object({ gameId: gameIdSchema, online: z.boolean() });
export type OpponentStatus = z.infer<typeof opponentStatusSchema>;

// ─── Ответы (acknowledgements) ───────────────────────────────────────────────

export const ERROR_CODES = [
  'invalid_payload',
  'not_found',
  'game_full',
  'not_a_player',
  'not_started',
  'game_over',
  'not_your_turn',
  'stale_ply',
  'illegal_move',
  'no_draw_offer',
  /** Ошибка на сервере (уже записана в лог и Sentry). */
  'server_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode };
export type AckFn<T = object> = (response: Ack<T>) => void;

/** События, которые шлёт клиент. Последний аргумент — подтверждение от сервера. */
export interface ClientToServerEvents {
  'game:create': (
    payload: CreateGamePayload,
    ack: AckFn<{ game: GameSnapshot; inviteUrl: string }>,
  ) => void;
  /** Войти в партию: занять свободное место или вернуться в свою после реконнекта. */
  'game:join': (payload: GameRefPayload, ack: AckFn<{ game: GameSnapshot }>) => void;
  'game:move': (payload: MovePayload, ack: AckFn) => void;
  'game:resign': (payload: GameRefPayload, ack: AckFn) => void;
  'game:draw-offer': (payload: GameRefPayload, ack: AckFn) => void;
  'game:draw-answer': (payload: DrawAnswerPayload, ack: AckFn) => void;
  /** Встать в очередь случайного подбора (5+3). Повторный вход ничего не меняет. */
  'queue:join': (payload: EmptyPayload, ack: AckFn) => void;
  'queue:leave': (payload: EmptyPayload, ack: AckFn) => void;
}

/** События, которые шлёт сервер. */
export interface ServerToClientEvents {
  session: (session: Session) => void;
  /** Второй игрок сел за доску — партия началась (обоим игрокам). */
  'game:start': (game: GameSnapshot) => void;
  'game:moved': (payload: GameMoved) => void;
  'game:over': (payload: GameOver) => void;
  'game:draw-offered': (payload: DrawOffered) => void;
  /** Предложение ничьей отклонено (тому, кто предлагал). */
  'game:draw-declined': (payload: GameRefPayload) => void;
  'opponent:status': (payload: OpponentStatus) => void;
  /** Соперник найден: партия уже создана и началась, клиент входит в неё через `game:join`. */
  'queue:matched': (payload: GameRefPayload) => void;
}

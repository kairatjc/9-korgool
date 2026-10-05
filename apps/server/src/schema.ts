import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/*
 * Таблицы Better Auth (пользователи, сессии, привязанные входы) — architecture.md §5.
 * Гость — обычный пользователь с `is_anonymous = true` (плагин `anonymous`).
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  ...timestamps,
});

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps,
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
);

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

/**
 * Законченные партии (architecture.md §5). Код партии `code` повторяется со временем:
 * он уникален только среди идущих партий, поэтому ключ — свой `id`.
 */
export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    /** `friend` — по ссылке, `queue` — из очереди подбора. */
    kind: text('kind').notNull(),
    whiteId: text('white_id').references(() => user.id, { onDelete: 'set null' }),
    blackId: text('black_id').references(() => user.id, { onDelete: 'set null' }),
    /** Контроль времени в секундах (5+3 → 300 и 3); null — без часов. */
    initialSeconds: integer('initial_seconds'),
    incrementSeconds: integer('increment_seconds'),
    /** `white_won`, `black_won`, `draw`, `cancelled`. */
    result: text('result').notNull(),
    /** `score`, `resign`, `timeout`, `disconnect`, `draw_agreed`, `no_first_move`. */
    reason: text('reason').notNull(),
    /** Номера лунок через пробел: «7 3 9 5». */
    moves: text('moves').notNull(),
    /** Итоговая позиция в нотации движка (`serialize`). */
    finalPosition: text('final_position').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('games_white_id_idx').on(t.whiteId, t.endedAt),
    index('games_black_id_idx').on(t.blackId, t.endedAt),
  ],
);

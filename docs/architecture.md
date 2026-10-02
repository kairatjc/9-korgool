# Архитектура

## 1. Общая схема

```
 Браузер (React SPA / PWA)                     Сервер (Node.js)
┌──────────────────────────┐   HTTPS (REST)   ┌──────────────────────────┐
│ UI: доска, лобби, профиль│ ───────────────▶ │ Fastify: auth, профиль,  │
│ Zustand store            │                  │ история партий           │
│ @korgool/engine          │   WebSocket      │                          │
│ Web Worker: бот          │ ◀──────────────▶ │ Socket.IO: партии,       │
└──────────────────────────┘  (Socket.IO)     │ подбор, часы             │
                                              │ @korgool/engine          │
                                              └─────┬──────────────┬─────┘
                                                    │              │
                                              ┌─────▼────┐   ┌─────▼─────┐
                                              │ Postgres │   │   Redis   │
                                              │ (данные) │   │ (онлайн)  │
                                              └──────────┘   └───────────┘
```

## 2. Структура репозитория

```
9-korgool/
├── apps/
│   ├── web/              # React + Vite клиент
│   └── server/           # Fastify + Socket.IO
├── packages/
│   ├── engine/           # правила, генерация ходов, сериализация, бот (без зависимостей)
│   ├── protocol/         # Zod-схемы событий WebSocket и REST DTO
│   └── ui/               # общие компоненты (если понадобятся)
├── docs/
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## 3. Игровой движок (`@korgool/engine`)

Чистые функции, иммутабельное состояние, 100% покрытие тестами.

```ts
type Side = 'white' | 'black';

interface GameState {
  pits: number[];               // 18 ячеек: 0..8 — белые, 9..17 — чёрные
  kazans: [number, number];     // [белые, чёрные]
  tuzdyks: [number | null, number | null]; // индекс лунки-туздука, принадлежащей белым/чёрным
  turn: Side;
  status: 'playing' | 'white_won' | 'black_won' | 'draw';
}

function initialState(): GameState;
function legalMoves(s: GameState): number[];          // номера лунок 1..9
function applyMove(s: GameState, pit: number): { state: GameState; events: MoveEvent[] };
function serialize(s: GameState): string;              // нотация из rules.md §7
function parse(str: string): GameState;
```

`MoveEvent[]` (`sow`, `capture`, `tuzdyk`, `game_over`) нужны клиенту для пошаговой анимации.

**Бот** (`engine/src/ai.ts`, `chooseMove(state, level)`): минимакс с альфа-бета-отсечением,
сначала перебираются ходы с захватом. Оценка позиции: разница казанов + бонус за туздук
+ мобильность. Уровень сложности = глубина / доля случайности: 1 — случайный ход (захваты
втрое вероятнее), 2 — глубина 2, 3 — глубина 6, 4 — пока глубина 7. Среди равных ходов
выбирается случайный. На клиенте поиск идёт в Web Worker (`apps/web/src/game/bot.worker.ts`).
Для уровня 4 (этап 4) — итеративное углубление, таблица транспозиций (Zobrist-хеш),
угрозы захвата в оценке и лимит по времени.

## 4. Реальное время: протокол

Все сообщения валидируются Zod-схемами из `packages/protocol`.

| Направление | Событие | Данные |
|---|---|---|
| C → S | `queue:join` / `queue:leave` | — (контроль времени фиксирован: 5+3) |
| C → S | `game:create` | `{ timeControl, color }` → `{ gameId, inviteUrl }` |
| C → S | `game:join` | `{ gameId }` |
| C → S | `game:move` | `{ gameId, pit, ply }` (`ply` — номер полухода, защита от дублей) |
| C → S | `game:resign` / `game:draw-offer` / `game:draw-answer` | |
| S → C | `game:start` | `{ gameId, players, state, clocks }` |
| S → C | `game:moved` | `{ pit, events, state, clocks, ply }` |
| S → C | `game:over` | `{ result, reason }` |
| S → C | `game:sync` | полное состояние (после реконнекта) |
| S → C | `opponent:status` | `{ online: boolean }` |

**Обработка хода на сервере:** получить партию из Redis → проверить, что ход игрока и `ply`
совпадает → `engine.applyMove` → пересчитать часы по серверному времени → сохранить
в Redis → разослать `game:moved` в комнату → при окончании партии записать её в Postgres.

**Часы** считаются только на сервере (время приёма хода). Клиент показывает локальный
отсчёт и корректируется по каждому `game:moved`. Флаг времени проверяет серверный таймер.

## 5. Модель данных (PostgreSQL)

```
users        (id, username, google_id, phone /* в планах, nullable */, avatar_url, country, locale, created_at, is_guest)
ratings      (user_id, time_class, rating, rd, volatility, games_count)   -- в планах, вместе с рейтингом
games        (id, white_id, black_id, time_control, status, result, reason,
              moves TEXT,  -- "7 3 9 5 ..."
              final_position TEXT, started_at, ended_at)
friendships  (user_id, friend_id, status, created_at)   -- в планах, вместе с друзьями
puzzles      (id, position, solution, difficulty)
```

**Redis:** `game:{id}` — состояние активной партии; `queue` — одна общая FIFO-очередь ожидающих, контроль 5+3 (первые двое образуют пару);
`online:{userId}` — присутствие с TTL *(в планах, для онлайн-статусов друзей)*.

## 6. Безопасность и честная игра

- Все ходы проверяет сервер; клиенту не доверяем.
- Rate limiting на REST и WebSocket (ходы, создание партий).
- *(в планах, вместе со входом по SMS)* защита OTP: лимиты на номер и IP, капча после нескольких попыток, хранение только хеша кода.
- Базовый античит: сравнение ходов игрока с ходами сильного бота по статистике партий (после MVP).
- HTTPS везде, cookie сессии `HttpOnly` + `SameSite`.

## 7. Масштабирование (когда понадобится)

- Несколько инстансов сервера за балансировщиком + Socket.IO Redis adapter.
- Партия «прилипает» к одному инстансу (sticky sessions) или блокировка через Redis.
- CDN для статики клиента.

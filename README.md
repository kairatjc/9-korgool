# 9-korgool — Тогуз коргоол онлайн

**Тогуз коргоол** (кырг. _Тогуз коргоол_ — «девять шариков») — традиционная кыргызская
настольная игра семейства манкала. Цель проекта — веб-платформа, где можно сыграть
в тогуз коргоол прямо в браузере:

- **с другом** — по ссылке-приглашению или за одним устройством;
- **со случайным соперником** — из тех, кто сейчас ищет игру;
- **с ботом** — несколько уровней сложности, в том числе офлайн.

## Документация

| Документ                                                       | О чём                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------- |
| [docs/rules.md](docs/rules.md)                                 | Правила игры: доска, ходы, захват, туздук, конец партии     |
| [docs/gameplay-and-features.md](docs/gameplay-and-features.md) | Геймплей, режимы игры и функционал платформы                |
| [docs/tech-stack.md](docs/tech-stack.md)                       | Выбор технологий и обоснование                              |
| [docs/architecture.md](docs/architecture.md)                   | Архитектура, структура репозитория, протокол, модель данных |
| [docs/roadmap.md](docs/roadmap.md)                             | Этапы разработки (MVP → релиз)                              |
| [docs/deploy.md](docs/deploy.md)                               | Деплой на VPS: домен, DNS, Docker Compose, автодеплой       |
| [docs/design/handoff.md](docs/design/handoff.md)               | Как handoff из Claude Design переносится в код              |
| [design/handoff/README.md](design/handoff/README.md)           | Эталонный дизайн (направление 1a «Жаңгак»): экраны, токены  |
| [design/DEVIATIONS.md](design/DEVIATIONS.md)                   | Отличия реализации от дизайна                               |

## Коротко о стеке

TypeScript везде: **React + Vite** на клиенте, **Node.js + Fastify + Socket.IO** на сервере,
общий пакет **`@korgool/engine`** с правилами игры (используется и клиентом, и сервером, и ботом),
**PostgreSQL** + **Redis**, деплой в **Docker**.

## Разработка

Нужны Node.js 22+ и pnpm 10+.

```sh
pnpm install
pnpm test        # тесты всех пакетов
pnpm typecheck   # проверка типов
pnpm lint        # ESLint
pnpm format      # Prettier
pnpm design:serve  # прототип дизайна: http://127.0.0.1:4500/handoff/index.html
pnpm --filter @korgool/web dev          # клиент: http://localhost:5173
pnpm --filter @korgool/server dev       # сервер партий: http://localhost:3000 (PORT, PUBLIC_URL);
                                        # клиент в dev проксирует к нему /socket.io и /api;
                                        # без DATABASE_URL база — PGlite в apps/server/.data,
                                        # без REDIS_URL партии только в памяти
pnpm --filter @korgool/server db:generate  # миграция после правки apps/server/src/schema.ts
pnpm --filter @korgool/web test:visual  # попиксельное сравнение с дизайном (Playwright)
DOMAIN=localhost POSTGRES_PASSWORD=dev BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose up -d --build  # весь сайт в Docker: https://localhost
```

В dev-сборке клиента есть `/__design?screen=…` (экраны дизайна из фикстур) и `/__design/compare`
(эталон и реализация рядом, наложение и разница).

| Пакет                                    | Что внутри                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`packages/engine`](packages/engine)     | `@korgool/engine` — правила игры: состояние, ходы, захват, туздук, конец партии, нотация                   |
| [`packages/protocol`](packages/protocol) | `@korgool/protocol` — Zod-схемы событий Socket.IO, общие типы клиента и сервера                            |
| [`apps/server`](apps/server)             | Сервер партий: Fastify + Socket.IO, гостевые аккаунты (Better Auth, PostgreSQL), ходы и часы (rules.md §8) |
| [`apps/web`](apps/web)                   | Веб-клиент: React + Vite, экраны из [дизайна](design/handoff/README.md), локальная игра и бот              |

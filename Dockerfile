# Сборка образов для деплоя (docs/deploy.md): `server` — сервер партий, `web` — Caddy со статикой клиента.
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
RUN pnpm install --frozen-lockfile
COPY . .
# Sentry для браузера включается при сборке, если задан DSN.
ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN pnpm --filter @korgool/server build && pnpm --filter @korgool/web exec vite build

# Сервер — один самодостаточный файл, node_modules не нужны.
FROM node:22-alpine AS server
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /repo/apps/server/dist/main.js ./main.js
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "main.js"]

# Caddy: HTTPS, статика клиента, /socket.io → сервер.
FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv

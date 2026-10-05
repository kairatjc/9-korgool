import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { RedisGameStore } from './store';
import { attachSentry, initSentry } from './sentry';

const config = loadConfig();
// PGlite и партии в памяти — только для разработки (docs/deploy.md).
if (process.env['NODE_ENV'] === 'production') {
  if (!config.databaseUrl) throw new Error('DATABASE_URL обязателен в продакшне');
  if (!config.redisUrl) throw new Error('REDIS_URL обязателен в продакшне');
}
const Sentry = await initSentry(config.sentryDsn);
const database = await openDatabase(config.databaseUrl, config.dataDir);
const store = config.redisUrl ? await RedisGameStore.connect(config.redisUrl) : undefined;
const { app } = buildApp({
  publicUrl: config.publicUrl,
  db: database.db,
  authSecret: config.authSecret,
  ...(store ? { store } : {}),
  logger: true,
  onError: (error, event) => Sentry?.captureException(error, { tags: { event } }),
});
attachSentry(Sentry, app);
app.addHook('onClose', async () => {
  await store?.close();
  await database.close();
});
if (!config.databaseUrl) app.log.warn(`DATABASE_URL не задан: PGlite в ${config.dataDir}`);
if (!store) app.log.warn('REDIS_URL не задан: партии не переживут перезапуск');

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}

await app.listen({ host: config.host, port: config.port });

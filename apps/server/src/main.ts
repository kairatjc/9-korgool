import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { attachSentry, initSentry } from './sentry';

const config = loadConfig();
// PGlite — только для разработки: в продакшн-образе его нет.
if (process.env['NODE_ENV'] === 'production' && !config.databaseUrl) {
  throw new Error('DATABASE_URL обязателен в продакшне (docs/deploy.md)');
}
const Sentry = await initSentry(config.sentryDsn);
const database = await openDatabase(config.databaseUrl, config.dataDir);
const { app } = buildApp({
  publicUrl: config.publicUrl,
  db: database.db,
  authSecret: config.authSecret,
  logger: true,
  onError: (error, event) => Sentry?.captureException(error, { tags: { event } }),
});
attachSentry(Sentry, app);
app.addHook('onClose', () => database.close());
if (!config.databaseUrl) app.log.warn(`DATABASE_URL не задан: PGlite в ${config.dataDir}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}

await app.listen({ host: config.host, port: config.port });

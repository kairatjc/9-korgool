import { buildApp } from './app';
import { loadConfig } from './config';
import { attachSentry, initSentry } from './sentry';

const config = loadConfig();
const Sentry = await initSentry(config.sentryDsn);
const { app } = buildApp({
  publicUrl: config.publicUrl,
  logger: true,
  onError: (error, event) => Sentry?.captureException(error, { tags: { event } }),
});
attachSentry(Sentry, app);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}

await app.listen({ host: config.host, port: config.port });

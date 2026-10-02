import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const { app } = buildApp({ publicUrl: config.publicUrl, logger: true });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void app.close().then(() => process.exit(0)));
}

await app.listen({ host: config.host, port: config.port });

import { defineConfig } from 'drizzle-kit';

// `pnpm --filter @korgool/server db:generate` — новая миграция после правки src/db/schema.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
});

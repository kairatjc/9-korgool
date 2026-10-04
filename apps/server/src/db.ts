import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export { schema };

/** База через Drizzle: PostgreSQL в продакшне, PGlite в разработке и тестах. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface Database {
  db: Db;
  close(): Promise<void>;
}

/** Миграции (drizzle-kit generate) лежат рядом со сборкой: `apps/server/drizzle`, в образе — `/app/drizzle`. */
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/**
 * Открыть базу и применить миграции.
 * `url` — строка подключения PostgreSQL; без неё — PGlite (Postgres внутри процесса):
 * в каталоге `dataDir` или в памяти, если каталог не задан.
 */
export async function openDatabase(url?: string, dataDir?: string): Promise<Database> {
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    const client = postgres(url, { onnotice: () => {} });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return { db, close: () => client.end() };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => client.close() };
}

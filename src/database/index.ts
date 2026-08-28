import { resolve } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import * as schema from './schema.js';

const connectionOptions = {
  host: process.env.PGHOST ?? 'localhost',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'label_log',
  username: process.env.PGUSER ?? 'label_log',
  password: process.env.PGPASSWORD ?? 'label_log',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
};

const client = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, connectionOptions)
  : postgres(connectionOptions);

export const db = drizzle(client, { schema });

export async function migrateDatabase(): Promise<void> {
  await migrate(db, {
    migrationsFolder: resolve(process.cwd(), 'drizzle'),
  });
}

export async function closeDatabase(): Promise<void> {
  await client.end();
}

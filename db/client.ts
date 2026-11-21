import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
const looksReal = Boolean(url && url.startsWith('postgres') && !url.includes('[') && !url.includes('<'));

/** Cloud sync stays off until a real pooler URL is present. Local mode needs zero setup. */
export const isDbConfigured = looksReal;

function createDb() {
  const client = postgres(url!, {
    prepare: false, // required for Supabase transaction pooler
    max: 1,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

let instance: Database | null = null;

export function getDb(): Database | null {
  if (!isDbConfigured) return null;
  instance ??= createDb();
  return instance;
}

/**
 * Phase 5 · Security ke liye chhota, self-contained Postgres layer.
 *
 * IMPORTANT: Ye file aapke existing lib/db.ts (agar hai) ko chhooti nahi.
 * Apna alag pool banati hai taaki kuch bhi purana break na ho.
 * Same DATABASE_URL use hota hai jo aapke baaki phases use karte hain.
 */
import { Pool, type PoolConfig } from 'pg';

export type SecurityRow = {
  id: number;
  current_token: string | null;
  password_hash: string | null;
  updated_at: string; // ISO string
};

const globalForPg = globalThis as unknown as { __phase5Pool?: Pool };

function connectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    '';
  if (!url) {
    throw new Error(
      'Phase 5: DATABASE_URL (ya POSTGRES_URL) set nahi hai. Vercel → Settings → Environment Variables mein add kar.'
    );
  }
  return url;
}

export function getPool(): Pool {
  if (globalForPg.__phase5Pool) return globalForPg.__phase5Pool;

  const url = connectionString();
  const isLocal = /localhost|127\.0\.0\.1/.test(url);

  const config: PoolConfig = {
    connectionString: url,
    max: 3, // serverless ke liye chhota pool
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supabase / Neon / Vercel Postgres sab managed TLS maangte hain
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  };

  const pool = new Pool(config);
  // pool error na aaye toh serverless function crash na ho
  pool.on('error', (err) => console.error('[phase5][pg] pool error:', err.message));

  globalForPg.__phase5Pool = pool;
  return pool;
}

/** Single row padho (id = 1). Row na ho toh seed kar do. */
export async function getSecurityRow(): Promise<SecurityRow> {
  const pool = getPool();

  const { rows } = await pool.query<SecurityRow>(
    `select id, current_token, password_hash, updated_at
       from public.app_security
      where id = 1
      limit 1`
  );
  if (rows[0]) return rows[0];

  // table/row missing ho (SQL chalana bhool gaye) toh politely bana do
  await pool.query(
    `insert into public.app_security (id, current_token, password_hash)
     values (1, null, null)
     on conflict (id) do nothing`
  );
  const created = await pool.query<SecurityRow>(
    `select id, current_token, password_hash, updated_at
       from public.app_security where id = 1 limit 1`
  );
  return created.rows[0];
}

export async function saveToken(token: string): Promise<SecurityRow> {
  const pool = getPool();
  const { rows } = await pool.query<SecurityRow>(
    `update public.app_security
        set current_token = $1,
            updated_at    = now()
      where id = 1
      returning id, current_token, password_hash, updated_at`,
    [token]
  );
  if (!rows[0]) throw new Error('app_security row missing (id=1)');
  return rows[0];
}

export async function savePasswordHash(hash: string): Promise<SecurityRow> {
  const pool = getPool();
  const { rows } = await pool.query<SecurityRow>(
    `update public.app_security
        set password_hash = $1,
            updated_at    = now()
      where id = 1
      returning id, current_token, password_hash, updated_at`,
    [hash]
  );
  if (!rows[0]) throw new Error('app_security row missing (id=1)');
  return rows[0];
}

/** Session epoch = updated_at (ms). Token/password badla => epoch badla => purane session dead. */
export function epochOf(row: Pick<SecurityRow, 'updated_at'>): number {
  const t = new Date(row.updated_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

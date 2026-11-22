/**
 * Phase 5 · Server-side (Node runtime) security helpers.
 * bcryptjs + pg yahan use hote hain — isliye sirf API routes / server components
 * me import karna. middleware.ts me kabhi nahi (wahan lib/security/session.ts use karo).
 */
import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getSecurityRow, savePasswordHash, saveToken, epochOf, type SecurityRow } from './db';
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
  type Session,
} from './session';

export const BCRYPT_ROUNDS = 11;

/* ------------------------------------------------------------------ */
/*  Dynamic token                                                      */
/* ------------------------------------------------------------------ */

/** nst_ + 40 hex chars (20 random bytes) */
export function generateToken(): string {
  return 'nst_' + crypto.randomBytes(20).toString('hex');
}

/** timing-safe string compare (length leak se bachne ke liye hash-first) */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/* ------------------------------------------------------------------ */
/*  Password                                                           */
/* ------------------------------------------------------------------ */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function checkPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Session read (with epoch check)                                    */
/* ------------------------------------------------------------------ */

type EpochCache = { at: number; epoch: number };
const globalCache = globalThis as unknown as { __phase5Epoch?: EpochCache };
const EPOCH_TTL_MS = 60_000; // 60s cache -> har request par DB hit nahi

async function currentEpoch(): Promise<number | null> {
  const now = Date.now();
  const c = globalCache.__phase5Epoch;
  if (c && now - c.at < EPOCH_TTL_MS) return c.epoch;
  try {
    const row = await getSecurityRow();
    const epoch = epochOf(row);
    globalCache.__phase5Epoch = { at: now, epoch };
    return epoch;
  } catch (err) {
    console.warn('[phase5] epoch check fail:', (err as Error).message);
    return null; // DB down -> fail open (app band na ho)
  }
}

export function invalidateEpochCache() {
  globalCache.__phase5Epoch = undefined;
}

/**
 * Session padho. `checkEpoch: true` par token/password rotate hone ke baad
 * purane session bhi reject ho jaate hain (server-side, cookie ke bawajood).
 */
export async function getSession(
  req: NextRequest,
  opts: { checkEpoch?: boolean } = {}
): Promise<Session | null> {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  if (opts.checkEpoch !== false) {
    const epoch = await currentEpoch();
    if (epoch !== null && session.ep < epoch) return null; // rotated -> dead session
  }
  return session;
}

/** API route guard. null return kare toh 401 bhej do. */
export async function requireSession(req: NextRequest): Promise<Session | null> {
  return getSession(req, { checkEpoch: true });
}

export function unauthorized(message = 'Login required. /login par jaake session banao.') {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

/** Login success -> cookie set karke response do. */
export async function attachSession(res: NextResponse, row: SecurityRow): Promise<NextResponse> {
  const token = await createSessionToken(epochOf(row));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  invalidateEpochCache();
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}

/* ------------------------------------------------------------------ */
/*  Simple in-memory rate limiter (brute-force se bachne ke liye)      */
/*  Sirf FAILED attempts count hote hain — sahi login par reset.       */
/* ------------------------------------------------------------------ */

type Bucket = { count: number; resetAt: number };
const g = globalThis as unknown as { __phase5RL?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = (g.__phase5RL ??= new Map());

export const RATE_LIMIT = { max: 8, windowMs: 10 * 60 * 1000 }; // 8 galat tries / 10 min

/** Kya ye key abhi blocked hai? (kuch count nahi karta) */
export function checkLimit(key: string, max = RATE_LIMIT.max) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) return { ok: true, remaining: max, retryAfter: 0 };
  const ok = b.count < max;
  return {
    ok,
    remaining: Math.max(0, max - b.count),
    retryAfter: ok ? 0 : Math.ceil((b.resetAt - now) / 1000),
  };
}

/** Ek failed attempt count karo. */
export function hitLimit(key: string, windowMs = RATE_LIMIT.windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count += 1;
  buckets.set(key, b);
}

/** Login success -> counter saaf. */
export function clearLimit(key: string) {
  buckets.delete(key);
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/* ------------------------------------------------------------------ */
/*  Rotation: naya token + naya password save                          */
/* ------------------------------------------------------------------ */

export async function rotateToken() {
  const token = generateToken();
  const row = await saveToken(token);
  invalidateEpochCache();
  return { token, row };
}

export async function setPassword(plain: string) {
  const hash = await hashPassword(plain);
  const row = await savePasswordHash(hash);
  invalidateEpochCache();
  return row;
}

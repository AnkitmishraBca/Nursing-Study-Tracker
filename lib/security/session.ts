/**
 * Phase 5 · Session tokens (Edge + Node dono par chalte hain).
 *
 * KYUN jose aur jsonwebtoken nahi?
 * -> middleware.ts Edge Runtime par chalta hai. `jsonwebtoken` Node ke
 *    crypto par depend karta hai, Edge par crash ho jaata hai.
 *    `jose` pure Web Crypto use karta hai, isliye middleware + API routes
 *    dono me same code chal jaata hai. (Bilkul same JWT HS256 format.)
 *
 * IMPORTANT: Ye file me sirf jose + Web APIs use hue hain,
 * pg / bcryptjs jaisi Node-only cheezein yahan mat add karna.
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'nst_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export type Session = {
  /** logged-in user (single-user app -> "owner") */
  sub: string;
  /** security epoch: app_security.updated_at (ms) jis waqt session bana */
  ep: number;
};

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32) {
    throw new Error(
      'Phase 5: SESSION_SECRET missing ya 32 chars se chhota hai. `openssl rand -hex 32` chala kar Vercel env me daal.'
    );
  }
  return new TextEncoder().encode(secret);
}

/** Naya 24-ghante wala signed session token. */
export async function createSessionToken(epoch: number): Promise<string> {
  return await new SignJWT({ ep: epoch })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject('owner')
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key());
}

/** Signature + expiry check. Invalid/expired -> null. */
export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (payload.sub !== 'owner') return null;
    return { sub: 'owner', ep: Number(payload.ep ?? 0) };
  } catch {
    return null;
  }
}

/** cookie options — HTTP-Only + Secure + SameSite=Lax + 24h */
export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** login page jahan redirect karna hai (open-redirect safe) */
export function safeNext(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  if (next.startsWith('/login')) return '/';
  return next;
}

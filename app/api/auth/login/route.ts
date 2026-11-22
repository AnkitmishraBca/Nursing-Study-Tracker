import { NextResponse, type NextRequest } from 'next/server';
import { getSecurityRow } from '@/lib/security/db';
import {
  attachSession,
  checkPassword,
  checkLimit,
  clearLimit,
  clientIp,
  hitLimit,
  safeEqual,
} from '@/lib/security/auth';
import { safeNext } from '@/lib/security/session';

export const runtime = 'nodejs'; // bcryptjs + pg -> Node runtime
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login
 * body: { mode: 'token', token: string }  |  { mode: 'password', password: string }
 *  -> 200 + HTTP-Only 24h cookie
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limitKey = `login:${ip}`;
  const rl = checkLimit(limitKey);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Bahut zyada galat attempts. ${Math.ceil(rl.retryAfter / 60)} min baad try kar.` },
      { status: 429, headers: { 'retry-after': String(rl.retryAfter) } }
    );
  }

  let body: { mode?: string; token?: string; password?: string; next?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const mode = body.mode === 'password' ? 'password' : body.mode === 'token' ? 'token' : null;
  if (!mode) {
    return NextResponse.json({ ok: false, error: "mode 'token' ya 'password' hona chahiye." }, { status: 400 });
  }

  let row;
  try {
    row = await getSecurityRow();
  } catch (err) {
    console.error('[phase5][login] db error:', (err as Error).message);
    return NextResponse.json(
      { ok: false, error: 'Database connect nahi hua. DATABASE_URL / 06_phase5.sql check kar.' },
      { status: 500 }
    );
  }

  let valid = false;

  if (mode === 'token') {
    const given = (body.token || '').trim();
    if (!given) return NextResponse.json({ ok: false, error: 'Token daal.' }, { status: 400 });
    if (!row.current_token) {
      return NextResponse.json(
        { ok: false, error: 'Abhi koi token generate nahi hua. Pehle password se login karke Settings se token banao.' },
        { status: 409 }
      );
    }
    valid = safeEqual(given, row.current_token);
    // purana token yahan automatically fail hota hai, kyunki DB me sirf latest token hai
  } else {
    const pass = body.password || '';
    if (!pass) return NextResponse.json({ ok: false, error: 'Password daal.' }, { status: 400 });
    if (!row.password_hash) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Password set nahi hai. Pehle Settings → Security me password set kar (ya token se login kar).',
        },
        { status: 409 }
      );
    }
    valid = await checkPassword(pass, row.password_hash);
  }

  if (!valid) {
    hitLimit(limitKey); // sirf galat attempt count hota hai
    return NextResponse.json(
      { ok: false, error: mode === 'token' ? 'Galat ya purana token.' : 'Galat password.' },
      { status: 401 }
    );
  }

  clearLimit(limitKey); // sahi login -> counter reset
  const res = NextResponse.json({ ok: true, mode, redirect: safeNext(body.next), expiresIn: 86400 });
  await attachSession(res, row);
  return res;
}

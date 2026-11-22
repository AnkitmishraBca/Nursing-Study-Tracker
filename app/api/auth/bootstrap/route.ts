import { NextResponse, type NextRequest } from 'next/server';
import { getSecurityRow } from '@/lib/security/db';
import { attachSession, checkLimit, clientIp, hitLimit, setPassword, safeEqual } from '@/lib/security/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/bootstrap   { setupKey, password }
 *
 * FIRST-RUN ONLY. Jab tak na token hai na password, koi login hi nahi kar sakta —
 * isliye pehla password set karne ka ek hi safe tarika: SETUP_KEY (env var).
 *
 * - Sirf tab chalta hai jab current_token == null AND password_hash == null.
 * - Ek baar password set hua -> ye endpoint dobara kabhi nahi chalega (410).
 * - SETUP_KEY env var hi "master" hai; ise Vercel me daal, kaam hone ke baad
 *   chaho to hata do (ya badal do) — endpoint tab bhi dead rahega.
 */
export async function POST(req: NextRequest) {
  const limitKey = `bootstrap:${clientIp(req)}`;
  const rl = checkLimit(limitKey, 5);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Bahut zyada attempts. 10 min baad try kar.' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfter) } }
    );
  }

  const expected = process.env.SETUP_KEY || '';
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'SETUP_KEY env var set nahi hai. Vercel → Settings → Environment Variables me SETUP_KEY daal (koi lamba random string), redeploy kar, phir try kar.',
      },
      { status: 503 }
    );
  }

  let body: { setupKey?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!safeEqual(String(body.setupKey || ''), expected)) {
    hitLimit(limitKey);
    return NextResponse.json({ ok: false, error: 'Setup key galat hai.' }, { status: 401 });
  }

  try {
    const row = await getSecurityRow();
    if (row.password_hash || row.current_token) {
      return NextResponse.json(
        { ok: false, error: 'Setup ho chuka hai. /login se login kar.' },
        { status: 410 }
      );
    }

    const password = String(body.password || '');
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password kam se kam 8 characters ka rakho.' }, { status: 400 });
    }

    const updated = await setPassword(password);
    const res = NextResponse.json({ ok: true, message: 'Password set ho gaya — login ready.', redirect: '/' });
    await attachSession(res, updated);
    return res;
  } catch (err) {
    console.error('[phase5][bootstrap]', (err as Error).message);
    return NextResponse.json({ ok: false, error: 'DB connect nahi hua.' }, { status: 500 });
  }
}

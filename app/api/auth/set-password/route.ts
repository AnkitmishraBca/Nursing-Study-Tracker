import { NextResponse, type NextRequest } from 'next/server';
import {
  attachSession,
  checkLimit,
  checkPassword,
  hitLimit,
  requireSession,
  setPassword,
} from '@/lib/security/auth';
import { getSecurityRow } from '@/lib/security/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/set-password
 * body: { password: string, confirm?: string, currentPassword?: string }
 *
 * - Login zaroori.
 * - Password bcryptjs se hash hoke DB me jaata hai (plain kabhi save nahi).
 * - Agar pehle se password hai to `currentPassword` maangta hai (koi aur
 *   browser khula ho to bhi password badal na sake).
 * - Rotate hone par session refresh hota hai (tu logged-in rehta hai).
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  const limitKey = `set-password:${session.sub}`;
  const rl = checkLimit(limitKey, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Bahut zyada attempts. Thodi der baad try kar.' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfter) } }
    );
  }

  let body: { password?: string; confirm?: string; currentPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const password = body.password || '';
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: 'Password kam se kam 8 characters ka rakho.' }, { status: 400 });
  }
  if (body.confirm !== undefined && body.confirm !== password) {
    return NextResponse.json({ ok: false, error: 'Confirm password match nahi kar raha.' }, { status: 400 });
  }

  try {
    const row = await getSecurityRow();

    // purana password hai? to verify karo
    if (row.password_hash) {
      const cur = body.currentPassword || '';
      if (!cur) {
        return NextResponse.json({ ok: false, error: 'Purana password daalna padega (verify ke liye).' }, { status: 400 });
      }
      const good = await checkPassword(cur, row.password_hash);
      if (!good) {
        hitLimit(limitKey);
        return NextResponse.json({ ok: false, error: 'Purana password galat hai.' }, { status: 401 });
      }
    }

    const updated = await setPassword(password);
    const res = NextResponse.json({
      ok: true,
      message: row.password_hash ? 'Password update ho gaya.' : 'Password set ho gaya.',
      updatedAt: updated.updated_at,
    });
    await attachSession(res, updated); // session refresh (dusre devices logged out)
    return res;
  } catch (err) {
    console.error('[phase5][set-password]', (err as Error).message);
    return NextResponse.json({ ok: false, error: 'Password save nahi hua. DB check kar.' }, { status: 500 });
  }
}

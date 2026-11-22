import { NextResponse, type NextRequest } from 'next/server';
import { requireSession } from '@/lib/security/auth';
import { getSecurityRow } from '@/lib/security/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/security-info  (login zaroori)
 * Settings page ke Security panel ke liye state.
 * Single-user private app hai, isliye current token bhi dikhate hain
 * (warna token kho jaane par lockout ho jaata).
 * `<reveal=true>` par full token, warna masked.
 */
export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  try {
    const row = await getSecurityRow();
    const reveal = req.nextUrl.searchParams.get('reveal') === 'true';
    const token = row.current_token;
    return NextResponse.json({
      ok: true,
      tokenSet: Boolean(token),
      passwordSet: Boolean(row.password_hash),
      token: token ? (reveal ? token : token.slice(0, 8) + '••••••••••••' + token.slice(-4)) : null,
      updatedAt: row.updated_at,
      sessionTtlHours: 24,
    });
  } catch (err) {
    console.error('[phase5][security-info]', (err as Error).message);
    return NextResponse.json({ ok: false, error: 'DB connect nahi hua.' }, { status: 500 });
  }
}

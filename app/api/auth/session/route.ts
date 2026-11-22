import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/security/auth';
import { getSecurityRow } from '@/lib/security/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/session  (public route)
 * Login page isse puchhta hai: logged in hoon ya nahi + first-time setup chahiye?
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req, { checkEpoch: true });

  // setupRequired = na token, na password -> pehla password SETUP_KEY se set hoga
  let setupRequired = false;
  try {
    const row = await getSecurityRow();
    setupRequired = !row.password_hash && !row.current_token;
  } catch {
    // DB down -> setup flow mat dikhao, bas "not logged in" bolo
  }

  if (!session) {
    return NextResponse.json({ ok: true, authenticated: false, setupRequired }, { status: 200 });
  }
  return NextResponse.json(
    { ok: true, authenticated: true, setupRequired: false, user: session.sub, ttlHours: 24 },
    { status: 200 }
  );
}

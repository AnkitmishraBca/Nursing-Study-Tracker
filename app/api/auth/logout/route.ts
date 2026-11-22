import { NextResponse, type NextRequest } from 'next/server';
import { clearSession } from '@/lib/security/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/auth/logout — cookie clear + /login par bhej do */
export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true, redirect: '/login' });
  clearSession(res);
  return res;
}

import { NextResponse, type NextRequest } from 'next/server';
import { attachSession, invalidateEpochCache, requireSession, rotateToken } from '@/lib/security/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/generate-token
 * Login zaroori. Naya dynamic token banata hai, DB me overwrite karta hai
 * (purana token turant invalid), aur current device ka session refresh karta hai
 * taaki tu logout na ho — baaki devices ka session rotate hoke mar jaata hai.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });

  try {
    const { token, row } = await rotateToken();
    const res = NextResponse.json({
      ok: true,
      token,
      updatedAt: row.updated_at,
      message: 'Naya token ban gaya. Purana token ab invalid hai.',
    });
    await attachSession(res, row); // new epoch -> session alive, dusre devices logged out
    invalidateEpochCache();
    return res;
  } catch (err) {
    console.error('[phase5][generate-token]', (err as Error).message);
    return NextResponse.json({ ok: false, error: 'Token generate nahi hua. DB check kar.' }, { status: 500 });
  }
}

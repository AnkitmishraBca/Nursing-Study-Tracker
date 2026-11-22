/**
 * Phase 5 · middleware.ts  (repo root me rakho — yaani /middleware.ts)
 *
 * Kaam: har route protect. Valid session cookie nahi -> /login par redirect.
 * API route par cookie nahi -> 401 JSON (redirect nahi, warna fetch break hoga).
 *
 * NOTE: middleware Edge Runtime par chalta hai, isliye sirf jose wala
 * lib/security/session.ts import hota hai — pg/bcrypt yahan nahi.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/security/session';

/** Ye routes bina login ke khule rehte hain */
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/session',
  '/api/auth/bootstrap', // first-run password setup (SETUP_KEY se protected)
]);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1) public routes
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // 2) session check (signature + 24h expiry)
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (session) return NextResponse.next();

  // 3) API -> JSON 401, page -> /login?next=...
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized: session cookie missing/expired. /login se login kar.' },
      { status: 401, headers: { 'cache-control': 'no-store' } }
    );
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname + search);
  return NextResponse.redirect(loginUrl);
}

/**
 * Almost sab kuch cover, sirf static assets chhod kar.
 * (PWA wali icons / manifest / fonts bina login ke load honi chahiye.)
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|images/|fonts/|manifest.webmanifest|robots.txt|sitemap.xml|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|txt|xml|webmanifest|woff|woff2|ttf|otf)$).*)',
  ],
};

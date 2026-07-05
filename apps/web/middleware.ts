import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware (M11): per-request nonce CSP + security headers on every response.
 *
 * Next.js injects inline bootstrap/hydration scripts, so a strict `script-src 'self'` breaks the app.
 * We generate a per-request nonce and use `'nonce-…' 'strict-dynamic'`; Next reads the nonce from the
 * request's Content-Security-Policy header and stamps it onto its scripts. In dev, `'unsafe-eval'` is
 * additionally required for Fast Refresh/HMR.
 */
function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE ?? '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    `connect-src 'self' ${streamBase} ${dev ? 'ws: http://localhost:*' : 'https:'}`.trim(),
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

const STATIC_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export function middleware(req: NextRequest): NextResponse {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const csp = buildCsp(nonce);

  // Pass the nonce + CSP to Next via request headers so it stamps its scripts.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  for (const [k, v] of Object.entries(STATIC_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};

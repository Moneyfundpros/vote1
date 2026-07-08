import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware: security headers + a Content-Security-Policy on every response.
 *
 * NOTE: This app statically pre-renders its pages, so a per-request nonce cannot be
 * stamped onto the already-baked script tags — a nonce + `strict-dynamic` policy would
 * block Next.js's own bundles and prevent React from hydrating (breaking every button).
 * We therefore use a static policy that allows the app's own (self + inline) scripts.
 */
function buildCsp(): string {
  const dev = process.env.NODE_ENV !== 'production';
  const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE ?? '';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
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

export function middleware(_req: NextRequest): NextResponse {
  const res = NextResponse.next();
  res.headers.set('Content-Security-Policy', buildCsp());
  for (const [k, v] of Object.entries(STATIC_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};

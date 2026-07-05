import { NextResponse } from 'next/server';
import { AppError, type Result } from '@voter/core';

/** Map a service Result to a JSON response with the right status + envelope. */
export function respond<T>(result: Result<T>, okStatus = 200): NextResponse {
  if (result.ok) {
    return NextResponse.json({ data: result.value }, { status: okStatus });
  }
  return errorResponse(result.error);
}

export function errorResponse(error: AppError): NextResponse {
  const headers = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined;
  return NextResponse.json(error.toBody(), { status: error.status, headers });
}

/** Catch-all for thrown errors (e.g. from guards). Maps AppError → its status, else 500. */
export function handleError(e: unknown): NextResponse {
  if (e instanceof AppError) return errorResponse(e);
  console.error('[api] unhandled', e);
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Internal error' } }, { status: 500 });
}

/** Client IP from Cloudflare/Vercel headers. */
export function clientIp(req: Request): string | undefined {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    undefined
  );
}

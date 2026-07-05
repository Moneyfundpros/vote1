import { NextResponse } from 'next/server';
import { otpRequestSchema } from '@voter/core';
import { RateLimiter } from '@voter/redis';
import { getTurnstile } from '@voter/security';
import { devMode, issueOtp } from '@/server/otp';
import { clientIp } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const otpLimiter = devMode ? null : new RateLimiter('otp');

/** POST /api/auth/login/request-otp — send a login OTP to a phone (rate-limited per phone + IP). */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid JSON' } }, { status: 422 });
  }
  const parsed = otpRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Enter a valid email or phone number' } }, { status: 422 });
  }
  if (!(await getTurnstile().verify(parsed.data.turnstileToken, 'otp', clientIp(req)))) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bot check failed' } }, { status: 403 });
  }
  const target = parsed.data.identifier.trim();
  const channel = /@/.test(target) ? 'email' : 'sms';
  if (otpLimiter) {
    const byPhone = await otpLimiter.limit(`phone:${target}`);
    const byIp = await otpLimiter.limit(`ip:${clientIp(req) ?? 'unknown'}`);
    if (!byPhone.success || !byIp.success) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many codes requested' } },
        { status: 429, headers: { 'Retry-After': String(byPhone.retryAfter ?? byIp.retryAfter ?? 60) } },
      );
    }
  }

  try {
    const { challengeId, devCode } = await issueOtp(target, channel);
    return NextResponse.json({ data: { challengeId, channel, devCode } }, { status: 202 });
  } catch (error) {
    console.error('[otp:request] failed', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL', message: 'Could not send the code right now' } },
      { status: 500 },
    );
  }
}

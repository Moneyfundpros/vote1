import { NextResponse } from 'next/server';
import { otpVerifySchema } from '@voter/core';
import { verifyOtp } from '@/server/otp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/login/verify-otp — validate the OTP. On success the upserted user + session is
 * established (wired to the Auth.js Credentials provider — see src/server/auth.ts TODO). For now this
 * returns the verified phone so the Credentials provider can complete sign-in.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid JSON' } }, { status: 422 });
  }
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid code' } }, { status: 422 });
  }

  const res = await verifyOtp(parsed.data.challengeId, parsed.data.code);
  if (!res.ok) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Invalid or expired code' } }, { status: 401 });
  }
  // TODO: upsert user by phone blind index (@voter/security phone MAC) + create the Auth.js session.
  return NextResponse.json({ data: { verified: true } });
}

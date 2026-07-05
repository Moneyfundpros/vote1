import { NextResponse } from 'next/server';
import { AppError, verificationStartSchema } from '@voter/core';
import { RateLimiter } from '@voter/redis';
import { getTurnstile } from '@voter/security';
import { auth } from '@/server/auth';
import { verificationService } from '@/server/verification-wiring';
import { clientIp, errorResponse } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const kycLimiter = new RateLimiter('kycStart');

/**
 * POST /api/verification/start — begin KYC.
 * Order (Privacy + cost): consent row written BEFORE any provider call; gate by phone+IP rate limit
 * + Turnstile so the expensive liveness call is never reached by bots/duplicate-account farms.
 * Returns a provider session token for the client widget (which collects the raw NIN/BVN, never us).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return errorResponse(new AppError('UNAUTHENTICATED'));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new AppError('VALIDATION', 'Invalid JSON'));
  }
  const parsed = verificationStartSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(new AppError('VALIDATION', 'Invalid input', { fields: parsed.error.flatten().fieldErrors as Record<string, string[]> }));
  }
  const { idType, phone, consentPolicyVersion, turnstileToken } = parsed.data;

  if (!(await getTurnstile().verify(turnstileToken, 'kyc', clientIp(req)))) {
    return errorResponse(new AppError('FORBIDDEN', 'Bot check failed'));
  }
  // Rate-limit the EXPENSIVE path by scarce resources (phone + IP), not just the account.
  const byPhone = await kycLimiter.limit(`phone:${phone}`);
  const byIp = await kycLimiter.limit(`ip:${clientIp(req) ?? 'unknown'}`);
  if (!byPhone.success || !byIp.success) {
    return errorResponse(new AppError('RATE_LIMITED', 'Too many verification attempts', { retryAfter: byPhone.retryAfter ?? byIp.retryAfter }));
  }

  // Record consent + set pending BEFORE any provider call (NDPA explicit consent).
  await verificationService().start({ userId, policyVersion: consentPolicyVersion });

  // TODO: call the provider to mint a widget session token (Dojah). The cheap lookup tier + dedup
  // pre-check run before the paid liveness step; the webhook finalizes via verification.service.
  const sessionToken = `kyc_${userId}_${idType}`;
  return NextResponse.json(
    { data: { sessionToken, provider: process.env.KYC_PROVIDER_PRIMARY ?? 'dojah', expiresAt: new Date(Date.now() + 600_000).toISOString() } },
    { status: 202 },
  );
}

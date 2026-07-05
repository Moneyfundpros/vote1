import { NextResponse } from 'next/server';
import { eq, getDb, users } from '@voter/db';
import { auth } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/verification/status — current KYC status (poll fallback). The live upgrade is via the
 * worker SSE on channel user:{id}:kyc; this endpoint is the always-available poll path.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, { status: 401 });

  const rows = await getDb().select({ kycStatus: users.kycStatus }).from(users).where(eq(users.id, userId)).limit(1);
  const kycStatus = rows[0]?.kycStatus ?? 'unverified';
  return NextResponse.json({ data: { kycStatus } });
}

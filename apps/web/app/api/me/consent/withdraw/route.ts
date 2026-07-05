import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, consentLedger, eq, getDb, isNull, sql } from '@voter/db';
import { auth } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ purpose: z.enum(['demographic_analytics', 'marketing']) });

/**
 * POST /api/me/consent/withdraw — withdraw a consent purpose (M12). Withdrawing
 * demographic_analytics stops future use; the retention sweep then drops the demographic columns.
 * kyc_identity cannot be withdrawn while the account remains verified (use /api/me/erase instead).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid purpose' } }, { status: 422 });

  await getDb()
    .update(consentLedger)
    .set({ withdrawnAt: sql`now()` })
    .where(and(eq(consentLedger.userId, userId), eq(consentLedger.purpose, parsed.data.purpose), isNull(consentLedger.withdrawnAt)));
  return NextResponse.json({ data: { withdrawn: parsed.data.purpose } });
}

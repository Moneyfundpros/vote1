import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';
import { getDb, kycAttempts, lt, securityEvents, sql } from '@voter/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash cron: enforce retention ceilings (M12). Drops aged kyc_attempts provider refs and old
 * security telemetry so pseudonymous-but-identifiable signals don't linger past their window.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  try {
    await verifyJob('retention-sweep', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }
  const db = getDb();
  // Null provider_ref on kyc_attempts older than 90 days (keep coarse outcome for analytics).
  await db
    .update(kycAttempts)
    .set({ providerRef: null })
    .where(lt(kycAttempts.createdAt, sql`now() - interval '90 days'`));
  // Delete security events older than the 90-day ceiling.
  await db.delete(securityEvents).where(lt(securityEvents.createdAt, sql`now() - interval '90 days'`));
  return NextResponse.json({ data: { ok: true } });
}

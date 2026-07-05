import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { and, consentLedger, eq, getDb, identityDedup, identityVerifications, isNull, profiles, sql, users } from '@voter/db';
import { auth } from '@/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/me/erase — NDPA right-to-erasure (M12).
 *
 * Strategy: the append-only vote ledger (votes/vote_receipts) is RETAINED for integrity, but every
 * PII attribute is destroyed so the remaining voter_id is an anonymous tombstone. We:
 *  - blank phone ciphertext + randomise the blind index (so it can no longer match a real phone),
 *  - drop email + all profile demographics,
 *  - NULL provider_ref everywhere (severs the one-hop re-identification join via the KYC processor),
 *  - withdraw all consents, and mark the account deleted.
 * Processor fan-out (Brevo/Resend/Sentry/B2/replica) is a TODO seam below — it must run to complete
 * erasure within the retention window.
 */
export async function POST(): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in' } }, { status: 401 });

  const db = getDb();
  await db
    .update(users)
    .set({ phoneEnc: 'erased', phoneBidx: randomBytes(32), email: null, status: 'deleted' })
    .where(eq(users.id, userId));
  await db
    .update(profiles)
    .set({ displayName: null, handle: null, avatarObjectKey: null, stateCode: null, lgaCode: null, ageBand: null, gender: null, demographicsConsent: false })
    .where(eq(profiles.userId, userId));
  // Sever the processor re-identification join.
  await db.update(identityVerifications).set({ providerRef: null }).where(eq(identityVerifications.userId, userId));
  await db.update(identityDedup).set({ providerRef: null }).where(eq(identityDedup.userId, userId));
  // Withdraw all active consents.
  await db.update(consentLedger).set({ withdrawnAt: sql`now()` }).where(and(eq(consentLedger.userId, userId), isNull(consentLedger.withdrawnAt)));

  // TODO: QStash fan-out — Brevo contact delete, Resend suppression, Sentry user deletion, B2 export
  // reconciliation, replica confirmation. Required to complete erasure across processors.
  return NextResponse.json({ data: { erased: true, note: 'Vote ledger retained anonymously for integrity.' } });
}

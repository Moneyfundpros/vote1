import { and, eq, getDb, identityDedup, identityVerifications, users } from '@voter/db';
import type { ConsentRepo, DedupClaim, IdentityRepo } from '../services/ports';
import { consentLedger, isNull } from '@voter/db';

/**
 * Identity repo (Drizzle, neon-http pooled — no interactive tx needed). The dedup claim is atomic via
 * ON CONFLICT DO NOTHING on the dedup_hmac PK; the user/verification updates follow.
 */
export class IdentityRepoDrizzle implements IdentityRepo {
  private readonly db = getDb();

  async claimDedup(params: {
    dedupHmac: Buffer;
    userId: string;
    provider: string;
    providerRef: string;
    idType: 'nin' | 'bvn';
  }): Promise<DedupClaim> {
    const claimed = await this.db
      .insert(identityDedup)
      .values({
        dedupHmac: params.dedupHmac,
        userId: params.userId,
        provider: params.provider,
        providerRef: params.providerRef,
        idType: params.idType,
      })
      .onConflictDoNothing({ target: identityDedup.dedupHmac })
      .returning({ userId: identityDedup.userId });
    return claimed.length > 0 ? { kind: 'claimed' } : { kind: 'duplicate' };
  }

  async markVerified(params: {
    userId: string;
    provider: string;
    providerRef: string;
    idType: 'nin' | 'bvn';
    faceMatch: boolean;
  }): Promise<void> {
    const now = new Date();
    await this.db.update(users).set({ kycStatus: 'verified', verifiedAt: now }).where(eq(users.id, params.userId));
    await this.db
      .insert(identityVerifications)
      .values({
        userId: params.userId,
        kycStatus: 'verified',
        providerUsed: params.provider,
        providerRef: params.providerRef,
        idType: params.idType,
        faceMatch: params.faceMatch,
        verifiedAt: now,
      })
      .onConflictDoNothing();
  }

  async markRejected(params: { userId: string; reason: string }): Promise<void> {
    await this.db.update(users).set({ kycStatus: 'rejected' }).where(eq(users.id, params.userId));
  }

  async setPending(userId: string): Promise<void> {
    await this.db.update(users).set({ kycStatus: 'pending' }).where(eq(users.id, userId));
  }
}

/** Consent ledger repo — explicit, per-purpose, withdrawable. */
export class ConsentRepoDrizzle implements ConsentRepo {
  private readonly db = getDb();

  async record(params: { userId: string; purpose: string; policyVersion: string; ipHmac?: Buffer }): Promise<void> {
    await this.db.insert(consentLedger).values({
      userId: params.userId,
      purpose: params.purpose,
      policyVersion: params.policyVersion,
      ipHmac: params.ipHmac ?? null,
    });
  }

  async hasActive(userId: string, purpose: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: consentLedger.id })
      .from(consentLedger)
      .where(
        and(eq(consentLedger.userId, userId), eq(consentLedger.purpose, purpose), isNull(consentLedger.withdrawnAt)),
      )
      .limit(1);
    return rows.length > 0;
  }
}

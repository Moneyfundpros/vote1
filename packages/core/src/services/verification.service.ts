import { AppError } from '../errors';
import { Ok, Err, type Result } from '../result';
import type {
  ConsentRepo,
  DedupMacPort,
  IdempotencyPort,
  IdentityRepo,
  KycSignalPort,
} from './ports';

export interface VerificationServiceDeps {
  identity: IdentityRepo;
  consent: ConsentRepo;
  mac: DedupMacPort;
  signal: KycSignalPort;
  idempotency: IdempotencyPort;
}

export interface FinalizeParams {
  userId: string;
  provider: string;
  providerRef: string;
  idType: 'nin' | 'bvn';
  /** Raw NIN/BVN — transient, MAC'd then discarded; NEVER persisted or logged. */
  rawId: string;
  faceMatch: boolean;
  verified: boolean;
}

export type FinalizeOutcome = 'verified' | 'duplicate' | 'rejected' | 'replayed';

/**
 * Finalize a KYC verification (called from the provider webhook). The raw NIN/BVN exists only in
 * `params.rawId` for the duration of this call: it is MAC'd inside the KMS to a dedup key and then
 * dropped. Nothing here persists or returns the raw id. Idempotent on provider_ref.
 */
export class VerificationService {
  constructor(private readonly d: VerificationServiceDeps) {}

  async finalize(params: FinalizeParams): Promise<Result<FinalizeOutcome>> {
    // Replay guard (provider may redeliver the webhook).
    const fresh = await this.d.idempotency.claimOnce(`webhook:kyc:${params.providerRef}`, 60 * 60 * 24);
    if (!fresh) return Ok('replayed');

    // A failed/!verified provider result → reject the account, no dedup claim.
    if (!params.verified || !params.faceMatch) {
      await this.d.identity.markRejected({ userId: params.userId, reason: 'provider_unverified' });
      await this.d.signal.publishStatus(params.userId, 'rejected', 'provider_unverified');
      return Ok('rejected');
    }

    // Derive the dedup key inside the KMS (ADR-0004) — raw id never leaves this frame.
    const dedupHmac = await this.d.mac.dedupMac(params.idType, params.rawId);

    const claim = await this.d.identity.claimDedup({
      dedupHmac,
      userId: params.userId,
      provider: params.provider,
      providerRef: params.providerRef,
      idType: params.idType,
    });

    if (claim.kind === 'duplicate') {
      await this.d.identity.markRejected({ userId: params.userId, reason: 'duplicate' });
      await this.d.signal.publishStatus(params.userId, 'rejected', 'duplicate');
      return Ok('duplicate');
    }

    await this.d.identity.markVerified({
      userId: params.userId,
      provider: params.provider,
      providerRef: params.providerRef,
      idType: params.idType,
      faceMatch: params.faceMatch,
    });
    await this.d.signal.publishStatus(params.userId, 'verified');
    return Ok('verified');
  }

  /** Record consent + set pending BEFORE any provider call (NDPA explicit consent). */
  async start(params: { userId: string; policyVersion: string; ipHmac?: Buffer }): Promise<Result<void>> {
    await this.d.consent.record({ userId: params.userId, purpose: 'kyc_identity', policyVersion: params.policyVersion, ipHmac: params.ipHmac });
    await this.d.identity.setPending(params.userId);
    return Ok(undefined);
  }

  /** Guard used by demographic analytics queries (must hold active consent). */
  async assertDemographicConsent(userId: string): Promise<Result<void>> {
    if (!(await this.d.consent.hasActive(userId, 'demographic_analytics'))) {
      return Err(new AppError('CONSENT_REQUIRED', 'Demographic analytics consent required'));
    }
    return Ok(undefined);
  }
}

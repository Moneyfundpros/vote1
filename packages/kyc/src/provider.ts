/**
 * KYC provider port. Adapters (Dojah, Smile ID) implement this; the router (index.ts) adds failover.
 *
 * PRIVACY (NDPA / NIMC, ADR-0004): the raw NIN/BVN exists in memory only for the duration of a
 * verification call. NOTHING in these types is persisted as-is — the caller derives a KMS-MAC'd
 * dedup key and stores only status + provider reference. Adapters MUST NOT log request bodies.
 */

export type KycTier = 'lookup' | 'liveness';

export interface LookupInput {
  idType: 'nin' | 'bvn';
  /** Raw government id — transient, never persisted/logged. Prefer vNIN tokens where supported. */
  idValue: string;
  phone: string;
}

export interface LivenessInput extends LookupInput {
  /** Provider session/job reference produced by the client widget for the liveness capture. */
  sessionRef: string;
}

export interface KycResult {
  /** Coarse outcome only — no name/DOB/photo flows past the adapter boundary. */
  verified: boolean;
  faceMatch?: boolean;
  /** Provider reference_id (e.g. DJ-479A8E4159) — PII-adjacent, short retention. */
  providerRef: string;
  reason?: string;
}

export interface KycProvider {
  readonly name: 'dojah' | 'smileid';
  /** Cheap DB lookup tier (NIN/BVN exists + matches phone). Run BEFORE the paid liveness tier. */
  lookup(input: LookupInput): Promise<KycResult>;
  /** Expensive liveness + selfie-to-ID face match. Only after lookup + dedup pre-check pass. */
  liveness(input: LivenessInput): Promise<KycResult>;
  /** Verify an inbound webhook signature (HMAC) against the provider secret. */
  verifyWebhook(rawBody: string, signature: string | null): boolean;
}

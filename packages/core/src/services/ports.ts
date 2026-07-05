/**
 * Dependency ports for services (dependency inversion). Concrete adapters live in
 * src/repositories (Drizzle) and in the @voter/redis, @voter/security, @voter/queue packages.
 * Services depend on these interfaces only, so they are framework-agnostic and unit-testable.
 */

export interface VotingContext {
  pollId: number;
  status: string;
  voteType: 'single' | 'multi' | 'ranked';
  maxSelections: number;
  opensAt: Date | null;
  closesAt: Date | null;
  allowedStates: string[] | null;
  validOptionIds: number[];
}

export interface CastBallotParams {
  pollId: number;
  voterId: string;
  idempotencyKey: string;
  /** KMS-MAC'd receipt token (secrecy-preserving). The receipt row is created in the same tx. */
  receiptHash: Buffer;
  castAt: Date;
  selections: { optionId: number; rank: number | null }[];
  stateCode: string | null;
  ageBand: string | null;
}

/**
 * Result of the atomic ballot claim (ADR-0001). Implemented as a single transaction:
 *   INSERT INTO ballots ... ON CONFLICT (poll_id, voter_id) DO NOTHING  (named target)
 *   + same-tx child INSERT INTO votes ...
 * - 'inserted'   : first vote — counters should be incremented.
 * - 'idem_replay': same (poll, voter) AND the stored idempotency_key equals the incoming one → 200.
 * - 'already_voted': same (poll, voter) but a DIFFERENT idempotency_key → 409. Never leaks others'
 *   receipts because the conflict row is, by definition, this same voter's own row.
 */
export type CastBallotResult =
  | { kind: 'inserted'; receiptId: string }
  | { kind: 'idem_replay'; receiptId: string }
  | { kind: 'already_voted' };

export interface VoteRepo {
  getVotingContext(pollId: number): Promise<VotingContext | null>;
  /** Re-validate now() <= closes_at at the DB level for polls near their boundary (Voting H3). */
  isOpenAtDb(pollId: number): Promise<boolean>;
  castBallot(params: CastBallotParams): Promise<CastBallotResult>;
}

export interface VoterProfile {
  kycStatus: string;
  stateCode: string | null;
  ageBand: string | null;
  demographicsConsent: boolean;
}

export interface UserRepo {
  getVoterProfile(userId: string): Promise<VoterProfile | null>;
}

/** Redis port (concrete in @voter/redis). */
export interface CountersPort {
  /** Returns true if the voter has already cast in this poll (fast pre-check before any lock). */
  hasVoted(pollId: number, voterId: string): Promise<boolean>;
  /** Mark voted + increment option/total shards in one pipeline; set the per-poll dirty flag. */
  recordVote(params: {
    pollId: number;
    voterId: string;
    optionIds: number[];
  }): Promise<void>;
}

/** KMS-backed MAC port (concrete in @voter/security). Pepper never enters this process (ADR-0004). */
export interface MacPort {
  receiptMac(input: Buffer): Promise<Buffer>;
}

/** Bot/abuse check (concrete in @voter/security). */
export interface TurnstilePort {
  verify(token: string, action: string, remoteIp?: string): Promise<boolean>;
}

/** Rate limiter (concrete in @voter/redis). */
export interface RateLimitPort {
  limit(key: string): Promise<{ success: boolean; retryAfter?: number }>;
}

/** Async work enqueue (concrete in @voter/queue). */
export interface QueuePort {
  enqueueReceiptEmail(params: { userId: string; pollId: number; receiptId: string }): Promise<void>;
  enqueueFreezeResults(pollId: number): Promise<void>;
  enqueueReconcile(pollId: number): Promise<void>;
}

// ---- Verification (KYC) ----

export type DedupClaim = { kind: 'claimed' } | { kind: 'duplicate' };

export interface IdentityRepo {
  /** Atomic one-human-one-account claim: INSERT identity_dedup ON CONFLICT DO NOTHING. */
  claimDedup(params: {
    dedupHmac: Buffer;
    userId: string;
    provider: string;
    providerRef: string;
    idType: 'nin' | 'bvn';
  }): Promise<DedupClaim>;
  markVerified(params: { userId: string; provider: string; providerRef: string; idType: 'nin' | 'bvn'; faceMatch: boolean }): Promise<void>;
  markRejected(params: { userId: string; reason: string }): Promise<void>;
  setPending(userId: string): Promise<void>;
}

export interface ConsentRepo {
  record(params: { userId: string; purpose: string; policyVersion: string; ipHmac?: Buffer }): Promise<void>;
  hasActive(userId: string, purpose: string): Promise<boolean>;
}

/** KMS-backed dedup MAC (concrete: deriveDedupKey in @voter/kyc). Pepper never enters this process. */
export interface DedupMacPort {
  dedupMac(idType: 'nin' | 'bvn', rawId: string): Promise<Buffer>;
}

/** Publish KYC status changes for the live verification screen (concrete in @voter/redis). */
export interface KycSignalPort {
  publishStatus(userId: string, status: string, reason?: string): Promise<void>;
}

/** Idempotency guard for webhook replays (concrete in @voter/redis). */
export interface IdempotencyPort {
  claimOnce(key: string, ttlSeconds: number): Promise<boolean>;
}

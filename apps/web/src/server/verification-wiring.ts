import {
  VerificationService,
  IdentityRepoDrizzle,
  ConsentRepoDrizzle,
  type DedupMacPort,
  type IdempotencyPort,
  type KycSignalPort,
} from '@voter/core';
import { deriveDedupKey } from '@voter/kyc';
import { claimOnce, publishJson } from '@voter/redis';

/** Composition root for the KYC verification service (M1). */
const macPort: DedupMacPort = { dedupMac: (idType, rawId) => deriveDedupKey(idType, rawId) };
const signalPort: KycSignalPort = {
  publishStatus: (userId, status, reason) => publishJson(`user:${userId}:kyc`, { status, reason }),
};
const idempotencyPort: IdempotencyPort = { claimOnce: (key, ttl) => claimOnce(key, ttl) };

let _svc: VerificationService | undefined;
export function verificationService(): VerificationService {
  if (!_svc) {
    _svc = new VerificationService({
      identity: new IdentityRepoDrizzle(),
      consent: new ConsentRepoDrizzle(),
      mac: macPort,
      signal: signalPort,
      idempotency: idempotencyPort,
    });
  }
  return _svc;
}

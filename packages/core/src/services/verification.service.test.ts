import { describe, expect, it, vi } from 'vitest';
import { VerificationService, type VerificationServiceDeps } from './verification.service';
import type { DedupClaim } from './ports';

function deps(over: Partial<VerificationServiceDeps> = {}, claim: DedupClaim = { kind: 'claimed' }): VerificationServiceDeps {
  return {
    identity: {
      claimDedup: vi.fn().mockResolvedValue(claim),
      markVerified: vi.fn().mockResolvedValue(undefined),
      markRejected: vi.fn().mockResolvedValue(undefined),
      setPending: vi.fn().mockResolvedValue(undefined),
    },
    consent: { record: vi.fn().mockResolvedValue(undefined), hasActive: vi.fn().mockResolvedValue(true) },
    mac: { dedupMac: vi.fn().mockResolvedValue(Buffer.from('dedup')) },
    signal: { publishStatus: vi.fn().mockResolvedValue(undefined) },
    idempotency: { claimOnce: vi.fn().mockResolvedValue(true) },
    ...over,
  };
}

const base = {
  userId: 'u1',
  provider: 'dojah',
  providerRef: 'DJ-1',
  idType: 'nin' as const,
  rawId: '12345678901',
  faceMatch: true,
  verified: true,
};

describe('VerificationService.finalize', () => {
  it('verifies a unique human and MACs the raw id (never persists it)', async () => {
    const d = deps();
    const res = await new VerificationService(d).finalize(base);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe('verified');
    expect(d.mac.dedupMac).toHaveBeenCalledWith('nin', '12345678901');
    expect(d.identity.markVerified).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate human (dedup conflict)', async () => {
    const d = deps({}, { kind: 'duplicate' });
    const res = await new VerificationService(d).finalize(base);
    expect(res.ok && res.value).toBe('duplicate');
    expect(d.identity.markRejected).toHaveBeenCalledOnce();
    expect(d.identity.markVerified).not.toHaveBeenCalled();
  });

  it('rejects when provider says unverified or face match failed', async () => {
    const d = deps();
    const res = await new VerificationService(d).finalize({ ...base, faceMatch: false });
    expect(res.ok && res.value).toBe('rejected');
    expect(d.mac.dedupMac).not.toHaveBeenCalled();
  });

  it('is idempotent on webhook replay', async () => {
    const d = deps();
    d.idempotency.claimOnce = vi.fn().mockResolvedValue(false);
    const res = await new VerificationService(d).finalize(base);
    expect(res.ok && res.value).toBe('replayed');
    expect(d.identity.claimDedup).not.toHaveBeenCalled();
  });
});

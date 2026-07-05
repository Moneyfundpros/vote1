import { describe, expect, it, vi } from 'vitest';
import { VoteService, type VoteServiceDeps } from './vote.service';
import type { CastBallotResult, VotingContext } from './ports';

function deps(over: Partial<VoteServiceDeps> = {}, castResult: CastBallotResult = { kind: 'inserted', receiptId: 'r1' }): VoteServiceDeps {
  const ctx: VotingContext = {
    pollId: 1,
    status: 'open',
    voteType: 'single',
    maxSelections: 1,
    opensAt: null,
    closesAt: null,
    allowedStates: null,
    validOptionIds: [10, 11],
  };
  return {
    votes: {
      getVotingContext: vi.fn().mockResolvedValue(ctx),
      isOpenAtDb: vi.fn().mockResolvedValue(true),
      castBallot: vi.fn().mockResolvedValue(castResult),
    },
    users: {
      getVoterProfile: vi.fn().mockResolvedValue({
        kycStatus: 'verified',
        stateCode: 'NG-LA',
        ageBand: '25-34',
        demographicsConsent: true,
      }),
    },
    counters: { hasVoted: vi.fn().mockResolvedValue(false), recordVote: vi.fn().mockResolvedValue(undefined) },
    mac: { receiptMac: vi.fn().mockResolvedValue(Buffer.from('mac')) },
    turnstile: { verify: vi.fn().mockResolvedValue(true) },
    rateLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
    queue: {
      enqueueReceiptEmail: vi.fn().mockResolvedValue(undefined),
      enqueueFreezeResults: vi.fn().mockResolvedValue(undefined),
      enqueueReconcile: vi.fn().mockResolvedValue(undefined),
    },
    ...over,
  };
}

const input = { idempotencyKey: '11111111-1111-1111-1111-111111111111', optionIds: [10], turnstileToken: 't' };

describe('VoteService.cast', () => {
  it('records a first vote and increments counters', async () => {
    const d = deps();
    const svc = new VoteService(d);
    const res = await svc.cast('voter-1', 1, input, {});
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.replay).toBe(false);
    expect(d.counters.recordVote).toHaveBeenCalledOnce();
    expect(d.queue.enqueueReceiptEmail).toHaveBeenCalledOnce();
  });

  it('returns 409 ALREADY_VOTED on a different idempotency key', async () => {
    const d = deps({}, { kind: 'already_voted' });
    const res = await new VoteService(d).cast('voter-1', 1, input, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('ALREADY_VOTED');
    expect(d.counters.recordVote).not.toHaveBeenCalled();
  });

  it('replays (200) the caller’s own receipt on the same idempotency key, no counter change', async () => {
    const d = deps({}, { kind: 'idem_replay', receiptId: 'r-existing' });
    const res = await new VoteService(d).cast('voter-1', 1, input, {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.replay).toBe(true);
      expect(res.value.receiptId).toBe('r-existing');
    }
    expect(d.counters.recordVote).not.toHaveBeenCalled();
  });

  it('short-circuits with ALREADY_VOTED on the Redis voted-bit before any DB work', async () => {
    const d = deps();
    d.counters.hasVoted = vi.fn().mockResolvedValue(true);
    const res = await new VoteService(d).cast('voter-1', 1, input, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('ALREADY_VOTED');
    expect(d.votes.castBallot).not.toHaveBeenCalled();
  });

  it('blocks an unverified voter with KYC_REQUIRED', async () => {
    const d = deps();
    d.users.getVoterProfile = vi.fn().mockResolvedValue({
      kycStatus: 'pending',
      stateCode: null,
      ageBand: null,
      demographicsConsent: false,
    });
    const res = await new VoteService(d).cast('voter-1', 1, input, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('KYC_REQUIRED');
  });

  it('rejects a closed poll at the DB-level re-check', async () => {
    const d = deps();
    d.votes.isOpenAtDb = vi.fn().mockResolvedValue(false);
    const res = await new VoteService(d).cast('voter-1', 1, input, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('POLL_CLOSED');
  });
});

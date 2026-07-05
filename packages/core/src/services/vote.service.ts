import { randomUUID } from 'node:crypto';
import { AppError } from '../errors';
import { Ok, Err, type Result } from '../result';
import type {
  CountersPort,
  MacPort,
  QueuePort,
  RateLimitPort,
  TurnstilePort,
  UserRepo,
  VoteRepo,
} from './ports';
import type { VoteInput } from '../validation/vote';

export interface VoteServiceDeps {
  votes: VoteRepo;
  users: UserRepo;
  counters: CountersPort;
  mac: MacPort;
  turnstile: TurnstilePort;
  rateLimit: RateLimitPort;
  queue: QueuePort;
}

export interface CastVoteOk {
  receiptId: string;
  recordedAt: string;
  replay: boolean;
}

/**
 * The vote write path (ADR-0001/0002/0003). Order is deliberate:
 *  1. Shed load: per-user + per-poll rate limit, then the Redis voted-bit short-circuit BEFORE any
 *     DB work or lock (defends the hot poll against re-vote floods).
 *  2. Turnstile (action-bound) + KYC-verified gate + region eligibility.
 *  3. DB-level open re-check against polls.closes_at (not just a cache) near the boundary.
 *  4. Create the receipt row (KMS-MAC'd, secrecy-preserving), then atomically claim the ballot:
 *       INSERT ballots ON CONFLICT (poll_id, voter_id) DO NOTHING + same-tx child votes rows.
 *     Branch deterministically on the typed CastBallotResult.
 *  5. After commit: increment option/total counters + dirty flag (NO inline chain, NO per-vote
 *     publish), and enqueue the receipt email.
 */
export class VoteService {
  constructor(private readonly d: VoteServiceDeps) {}

  async cast(
    voterId: string,
    pollId: number,
    input: VoteInput,
    ctx: { remoteIp?: string },
  ): Promise<Result<CastVoteOk>> {
    // 1. Rate limit (per user AND per poll) then the cheap voted-bit short-circuit.
    const rl = await this.d.rateLimit.limit(`vote:${voterId}`);
    if (!rl.success) return Err(new AppError('RATE_LIMITED', 'Too many requests', { retryAfter: rl.retryAfter }));
    const rlPoll = await this.d.rateLimit.limit(`vote:poll:${pollId}`);
    if (!rlPoll.success)
      return Err(new AppError('RATE_LIMITED', 'Poll is busy, retry shortly', { retryAfter: rlPoll.retryAfter }));

    if (await this.d.counters.hasVoted(pollId, voterId)) {
      return Err(new AppError('ALREADY_VOTED', 'You have already voted in this poll'));
    }

    // 2. Bot + identity + eligibility gates.
    const human = await this.d.turnstile.verify(input.turnstileToken, 'vote', ctx.remoteIp);
    if (!human) return Err(new AppError('FORBIDDEN', 'Bot check failed'));

    const profile = await this.d.users.getVoterProfile(voterId);
    if (!profile) return Err(new AppError('NOT_FOUND', 'Voter not found'));
    if (profile.kycStatus !== 'verified') return Err(new AppError('KYC_REQUIRED', 'Identity verification required'));

    const vctx = await this.d.votes.getVotingContext(pollId);
    if (!vctx) return Err(new AppError('NOT_FOUND', 'Poll not found'));
    if (vctx.status !== 'open') return Err(new AppError('POLL_NOT_OPEN', 'This poll is not open for voting'));

    // Selection shape vs poll type.
    const sel = this.normalizeSelections(input, vctx.maxSelections, vctx.voteType);
    if (!sel.ok) return Err(sel.error);
    for (const s of sel.value) {
      if (!vctx.validOptionIds.includes(s.optionId)) {
        return Err(new AppError('VALIDATION', `Invalid option ${s.optionId}`, { fields: { optionIds: ['invalid option'] } }));
      }
    }

    if (vctx.allowedStates && (!profile.stateCode || !vctx.allowedStates.includes(profile.stateCode))) {
      return Err(new AppError('NOT_ELIGIBLE_REGION', 'You are not eligible to vote in this poll'));
    }

    // 3. DB-level close re-check near the boundary (Voting H3).
    if (!(await this.d.votes.isOpenAtDb(pollId))) {
      return Err(new AppError('POLL_CLOSED', 'Voting has closed for this poll'));
    }

    // 4. Receipt MAC (secrecy-preserving) then atomic ballot claim — the receipt row is written
    //    inside the same transaction as the ballot, so a conflict never orphans a receipt.
    const castAt = new Date();
    const nonce = randomUUID();
    const receiptHash = await this.d.mac.receiptMac(
      Buffer.from(`${pollId}|${voterId}|${castAt.toISOString()}|${nonce}`),
    );

    // Demographics snapshot — only when consented; NULL otherwise (bucketed 'unknown' in counters).
    const stateCode = profile.demographicsConsent ? profile.stateCode : null;
    const ageBand = profile.demographicsConsent ? profile.ageBand : null;

    const result = await this.d.votes.castBallot({
      pollId,
      voterId,
      idempotencyKey: input.idempotencyKey,
      receiptHash,
      castAt,
      selections: sel.value,
      stateCode,
      ageBand,
    });

    if (result.kind === 'already_voted') {
      return Err(new AppError('ALREADY_VOTED', 'You have already voted in this poll'));
    }
    if (result.kind === 'idem_replay') {
      // Retry of the same request — return the caller's OWN existing receipt, no counter change.
      return Ok({ receiptId: result.receiptId, recordedAt: castAt.toISOString(), replay: true });
    }

    // 5. After commit: counters + dirty flag (no chain, no per-vote publish), then async email.
    await this.d.counters.recordVote({ pollId, voterId, optionIds: sel.value.map((s) => s.optionId) });
    await this.d.queue.enqueueReceiptEmail({ userId: voterId, pollId, receiptId: result.receiptId });

    return Ok({ receiptId: result.receiptId, recordedAt: castAt.toISOString(), replay: false });
  }

  private normalizeSelections(
    input: VoteInput,
    maxSelections: number,
    voteType: 'single' | 'multi' | 'ranked',
  ): Result<{ optionId: number; rank: number | null }[]> {
    if (voteType === 'single' && input.optionIds.length !== 1) {
      return Err(new AppError('VALIDATION', 'Single-choice poll requires exactly one option'));
    }
    if (input.optionIds.length > maxSelections) {
      return Err(new AppError('VALIDATION', `At most ${maxSelections} selections allowed`));
    }
    const unique = new Set(input.optionIds);
    if (unique.size !== input.optionIds.length) {
      return Err(new AppError('VALIDATION', 'Duplicate options are not allowed'));
    }
    const selections = input.optionIds.map((optionId, i) => ({
      optionId,
      rank: voteType === 'ranked' ? (input.ranks?.[i] ?? i + 1) : null,
    }));
    return Ok(selections);
  }
}

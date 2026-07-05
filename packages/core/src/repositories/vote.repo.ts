import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { ballots, eligibilityRules, pollOptions, polls, voteReceipts, votes, type WriteDatabase } from '@voter/db';
import type { CastBallotParams, CastBallotResult, VoteRepo, VotingContext } from '../services/ports';

type Db = WriteDatabase;

/**
 * Drizzle implementation of VoteRepo (ADR-0001/0002/0003).
 *
 * Requires a transaction-capable driver. On Vercel the write path uses drizzle-orm/neon-serverless
 * (WebSocket Pool) because the neon-http driver does NOT support interactive transactions.
 */
export class VoteRepoDrizzle implements VoteRepo {
  constructor(private readonly db: Db) {}

  async getVotingContext(pollId: number): Promise<VotingContext | null> {
    const rows = await this.db
      .select({
        pollId: polls.id,
        status: polls.status,
        voteType: polls.voteType,
        maxSelections: polls.maxSelections,
        opensAt: polls.opensAt,
        closesAt: polls.closesAt,
        allowedStates: eligibilityRules.allowedStates,
      })
      .from(polls)
      .leftJoin(eligibilityRules, eq(polls.eligibilityRuleId, eligibilityRules.id))
      .where(eq(polls.id, pollId))
      .limit(1);

    const p = rows[0];
    if (!p) return null;

    const opts = await this.db
      .select({ id: pollOptions.id })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, pollId));

    return {
      pollId: p.pollId,
      status: p.status,
      voteType: p.voteType as VotingContext['voteType'],
      maxSelections: p.maxSelections,
      opensAt: p.opensAt,
      closesAt: p.closesAt,
      allowedStates: p.allowedStates ?? null,
      validOptionIds: opts.map((o) => o.id),
    };
  }

  async isOpenAtDb(pollId: number): Promise<boolean> {
    const rows = await this.db
      .select({ id: polls.id })
      .from(polls)
      .where(
        and(
          eq(polls.id, pollId),
          eq(polls.status, 'open'),
          or(isNull(polls.closesAt), gt(polls.closesAt, sql`now()`)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async castBallot(params: CastBallotParams): Promise<CastBallotResult> {
    // Pre-generate the receipt id so the ballot can be claimed FIRST; the receipt row is only
    // written when the ballot wins, so a conflict never produces an orphan receipt.
    const receiptId = randomUUID();

    return this.db.transaction(async (tx) => {
      // Atomic one-ballot-per-human claim (ADR-0001). Named conflict target so the constraint is
      // unambiguous and the branch below is deterministic.
      const inserted = await tx
        .insert(ballots)
        .values({
          pollId: params.pollId,
          voterId: params.voterId,
          idempotencyKey: params.idempotencyKey,
          receiptId,
          castAt: params.castAt,
        })
        .onConflictDoNothing({ target: [ballots.pollId, ballots.voterId] })
        .returning({ receiptId: ballots.receiptId });

      if (inserted.length === 0) {
        // Conflict: the existing row is, by definition, THIS voter's own ballot — never another's.
        const [existing] = await tx
          .select({ idempotencyKey: ballots.idempotencyKey, receiptId: ballots.receiptId })
          .from(ballots)
          .where(and(eq(ballots.pollId, params.pollId), eq(ballots.voterId, params.voterId)))
          .limit(1);

        if (existing && existing.idempotencyKey === params.idempotencyKey) {
          return { kind: 'idem_replay', receiptId: existing.receiptId };
        }
        return { kind: 'already_voted' };
      }

      // Ballot won — write the receipt (R-B) and the child option rows into the partitioned ledger.
      await tx.insert(voteReceipts).values({
        id: receiptId,
        pollId: params.pollId,
        voterId: params.voterId,
        receiptHash: params.receiptHash,
        castAt: params.castAt,
      });

      await tx.insert(votes).values(
        params.selections.map((s) => ({
          pollId: params.pollId,
          voterId: params.voterId,
          optionId: s.optionId,
          rank: s.rank,
          stateCode: params.stateCode,
          ageBand: params.ageBand,
          castAt: params.castAt,
        })),
      );

      return { kind: 'inserted', receiptId };
    });
  }
}

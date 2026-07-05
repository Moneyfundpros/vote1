import { createHash } from 'node:crypto';
import { and, eq, gt, lte, sql, type WriteDatabase } from '@voter/db';
import { certifiedResults, pollReconcileState, pollTally, polls, votes } from '@voter/db';

export interface FreezeResult {
  totalVotes: number;
  checksum: string;
  snapshot: unknown;
}

/**
 * Results reconciliation + freeze (ADR-0005, critique C3/H5).
 *
 * Reconcile is INCREMENTAL with a FIXED upper bound: compute maxId once, aggregate only rows in
 * (watermark, maxId], then advance the watermark to maxId. Rows committed after maxId are picked up
 * next run — so a concurrent post-commit INCR can never be double-counted or erased by a blind SET.
 * poll_tally is the durable, authoritative tally; freeze certifies from it.
 */
export class ResultsRepoDrizzle {
  constructor(private readonly db: WriteDatabase) {}

  async incrementalReconcile(pollId: number): Promise<{ applied: number; watermark: number }> {
    return this.db.transaction(async (tx) => {
      const [state] = await tx
        .select({ lastVoteId: pollReconcileState.lastVoteId })
        .from(pollReconcileState)
        .where(eq(pollReconcileState.pollId, pollId))
        .limit(1);
      const watermark = state?.lastVoteId ?? 0;

      const [bound] = await tx
        .select({ maxId: sql<number>`coalesce(max(${votes.id}), ${watermark})` })
        .from(votes)
        .where(and(eq(votes.pollId, pollId), gt(votes.id, watermark)));
      const maxId = bound?.maxId ?? watermark;
      if (maxId <= watermark) return { applied: 0, watermark };

      const window = and(eq(votes.pollId, pollId), gt(votes.id, watermark), lte(votes.id, maxId));

      // total dimension
      const totals = await tx
        .select({ optionId: votes.optionId, c: sql<number>`count(*)::int` })
        .from(votes)
        .where(window)
        .groupBy(votes.optionId);
      // geo dimension (NULL state → 'unknown' bucket; non-consented voters have NULL by design)
      const geo = await tx
        .select({ optionId: votes.optionId, dimKey: sql<string>`coalesce(${votes.stateCode}, 'unknown')`, c: sql<number>`count(*)::int` })
        .from(votes)
        .where(window)
        .groupBy(votes.optionId, sql`coalesce(${votes.stateCode}, 'unknown')`);
      // demo dimension (NULL age band → 'unknown')
      const demo = await tx
        .select({ optionId: votes.optionId, dimKey: sql<string>`coalesce(${votes.ageBand}, 'unknown')`, c: sql<number>`count(*)::int` })
        .from(votes)
        .where(window)
        .groupBy(votes.optionId, sql`coalesce(${votes.ageBand}, 'unknown')`);

      const upsert = async (optionId: number, dimension: string, dimKey: string, delta: number): Promise<void> => {
        await tx
          .insert(pollTally)
          .values({ pollId, optionId, dimension, dimKey, count: delta })
          .onConflictDoUpdate({
            target: [pollTally.pollId, pollTally.optionId, pollTally.dimension, pollTally.dimKey],
            set: { count: sql`${pollTally.count} + ${delta}`, recomputedAt: sql`now()` },
          });
      };
      for (const d of totals) await upsert(d.optionId, 'total', '_', d.c);
      for (const d of geo) await upsert(d.optionId, 'geo', d.dimKey, d.c);
      for (const d of demo) await upsert(d.optionId, 'demo', d.dimKey, d.c);

      await tx
        .insert(pollReconcileState)
        .values({ pollId, lastVoteId: maxId })
        .onConflictDoUpdate({ target: pollReconcileState.pollId, set: { lastVoteId: maxId, updatedAt: sql`now()` } });

      return { applied: totals.reduce((a, b) => a + b.c, 0), watermark: maxId };
    });
  }

  /** Certify a closed poll: final reconcile, snapshot from poll_tally, hash-stamp, mark certified. */
  async freeze(pollId: number): Promise<FreezeResult> {
    await this.incrementalReconcile(pollId);
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({ optionId: pollTally.optionId, count: pollTally.count })
        .from(pollTally)
        .where(and(eq(pollTally.pollId, pollId), eq(pollTally.dimension, 'total')));

      const total = rows.reduce((a, r) => a + r.count, 0);
      const snapshot = {
        pollId,
        total,
        options: rows.map((r) => ({ optionId: r.optionId, count: r.count })),
        frozenAt: new Date().toISOString(),
      };
      const checksum = createHash('sha256').update(JSON.stringify(snapshot)).digest();

      await tx
        .insert(certifiedResults)
        .values({
          pollId,
          snapshot,
          totalVotes: total,
          checksum,
          exportObjectKey: `exports/poll-${pollId}.json`,
        })
        .onConflictDoNothing();
      await tx.update(polls).set({ status: 'certified' }).where(eq(polls.id, pollId));

      return { totalVotes: total, checksum: checksum.toString('hex'), snapshot };
    });
  }
}

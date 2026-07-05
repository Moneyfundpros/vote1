import { and, asc, eq, getReplicaDb, gt, sql } from '@voter/db';
import { pollTally, votes } from '@voter/db';

export interface BreakdownRow {
  optionId: number;
  dimKey: string;
  count: number;
}
export interface TrendPoint {
  bucket: string;
  count: number;
}

/**
 * Read-only analytics over poll_tally (geo/demo) and votes (trend). Always on the replica so it never
 * contends with the write primary. Geo/demo are inherently consent-respecting: non-consented voters
 * have NULL state/age (bucketed 'unknown') at cast time.
 */
export class AnalyticsRepoDrizzle {
  async breakdown(pollId: number, dimension: 'geo' | 'demo' | 'total'): Promise<BreakdownRow[]> {
    return getReplicaDb()
      .select({ optionId: pollTally.optionId, dimKey: pollTally.dimKey, count: pollTally.count })
      .from(pollTally)
      .where(and(eq(pollTally.pollId, pollId), eq(pollTally.dimension, dimension)));
  }

  /** Vote velocity: per-hour counts over the last `days` (capped). */
  async trend(pollId: number, days = 7): Promise<TrendPoint[]> {
    const since = sql`now() - (${days} || ' days')::interval`;
    return getReplicaDb()
      .select({
        bucket: sql<string>`to_char(date_trunc('hour', ${votes.castAt}), 'YYYY-MM-DD"T"HH24:00')`,
        count: sql<number>`count(*)::int`,
      })
      .from(votes)
      .where(and(eq(votes.pollId, pollId), gt(votes.castAt, since)))
      .groupBy(sql`date_trunc('hour', ${votes.castAt})`)
      .orderBy(asc(sql`date_trunc('hour', ${votes.castAt})`));
  }
}

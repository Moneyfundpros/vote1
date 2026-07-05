import { eq } from 'drizzle-orm';
import { getReplicaDb, pollOptions } from '@voter/db';
import { RedisCounters } from '@voter/redis';

export interface ResultSnapshot {
  pollId: number;
  total: number;
  options: { optionId: number; label: string; count: number; pct: number }[];
  asOf: string;
}

const counters = new RedisCounters();

/**
 * Compute the merged snapshot for a poll by summing Redis shards once (ADR-0005). Only the
 * aggregation leader calls this, on its tick; readers consume the single snapshot key.
 * Option labels come from the read replica (cached in a real impl).
 */
export async function computeSnapshot(pollId: number): Promise<ResultSnapshot> {
  const opts = await getReplicaDb()
    .select({ id: pollOptions.id, label: pollOptions.label })
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId));

  const counts = await Promise.all(opts.map((o) => counters.sumOption(pollId, o.id)));
  const total = counts.reduce<number>((a, b) => a + b, 0);

  return {
    pollId,
    total,
    options: opts.map((o, i) => {
      const count = counts[i] ?? 0;
      return { optionId: o.id, label: o.label, count, pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 };
    }),
    asOf: new Date().toISOString(),
  };
}

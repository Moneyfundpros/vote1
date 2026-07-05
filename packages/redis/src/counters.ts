import { getRedis, keys, SHARD_COUNT } from './client';

/**
 * Live vote counters (ADR-0005). The write path increments OPTION + TOTAL shards only and sets a
 * per-poll dirty flag; geo/demo breakdowns are derived from the Postgres reconcile, NOT live counters.
 * There is NO per-vote publish — the aggregation leader reads the dirty flag/snapshot on its tick.
 */
export class RedisCounters {
  private readonly redis = getRedis();

  /** Cheap pre-check before any DB work or lock. */
  async hasVoted(pollId: number, voterId: string): Promise<boolean> {
    const v = await this.redis.exists(keys.votedBit(pollId, voterId));
    return v === 1;
  }

  /** Mark voted + increment option/total shards in one pipeline; flag the poll dirty. */
  async recordVote(params: { pollId: number; voterId: string; optionIds: number[] }): Promise<void> {
    const { pollId, voterId, optionIds } = params;
    const shard = Math.floor(Math.random() * SHARD_COUNT);
    const p = this.redis.pipeline();
    // voted bit with a long TTL (poll lifetime); existence is the dedup signal.
    p.set(keys.votedBit(pollId, voterId), 1, { ex: 60 * 60 * 24 * 90 });
    for (const optionId of optionIds) {
      p.incr(keys.optionShard(pollId, optionId, shard));
    }
    p.incr(keys.totalShard(pollId, shard));
    p.set(keys.dirty(pollId), 1);
    await p.exec();
  }

  /** Sum all shards for an option (used by the aggregation leader only, once per tick). */
  async sumOption(pollId: number, optionId: number): Promise<number> {
    const ks = Array.from({ length: SHARD_COUNT }, (_, i) => keys.optionShard(pollId, optionId, i));
    const vals = await this.redis.mget<(number | null)[]>(...ks);
    return vals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
  }

  async sumTotal(pollId: number): Promise<number> {
    const ks = Array.from({ length: SHARD_COUNT }, (_, i) => keys.totalShard(pollId, i));
    const vals = await this.redis.mget<(number | null)[]>(...ks);
    return vals.reduce<number>((acc, v) => acc + (v ?? 0), 0);
  }

  /**
   * Reset shard counters from authoritative Postgres values. DANGER (critique C3): a blind SET races
   * in-flight post-commit INCRs and can double-count or erase live votes. Use ONLY at/after freeze
   * (poll closed, no new INCRs), or via the corrected-base + live-delta pattern. During live voting,
   * the aggregation leader should publish a snapshot rather than overwrite shards.
   */
  async healAfterFreeze(pollId: number, optionId: number, total: number): Promise<void> {
    const p = this.redis.pipeline();
    p.set(keys.optionShard(pollId, optionId, 0), total);
    for (let i = 1; i < SHARD_COUNT; i++) p.del(keys.optionShard(pollId, optionId, i));
    await p.exec();
  }
}

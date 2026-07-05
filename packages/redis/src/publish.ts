import { getRedis, keys } from './client';

/**
 * Dirty-flag coordination (ADR-0005). The write path sets the per-poll dirty flag (in recordVote);
 * the aggregation leader clears it after recomputing the snapshot. We deliberately AVOID a per-vote
 * PUBLISH (halves write-side Redis cost and removes the replica delivery multiplier).
 */
export class PollSignals {
  private readonly redis = getRedis();

  async isDirty(pollId: number): Promise<boolean> {
    return (await this.redis.exists(keys.dirty(pollId))) === 1;
  }

  async clearDirty(pollId: number): Promise<void> {
    await this.redis.del(keys.dirty(pollId));
  }

  /** Write the merged snapshot blob all readers consume (single key — O(1) reads). */
  async writeSnapshot(pollId: number, snapshot: unknown): Promise<void> {
    await this.redis.set(keys.snapshot(pollId), JSON.stringify(snapshot), { ex: 60 * 60 });
  }

  async readSnapshot<T>(pollId: number): Promise<T | null> {
    const raw = await this.redis.get<string>(keys.snapshot(pollId));
    return raw ? (JSON.parse(raw) as T) : null;
  }

  /** Aggregation-leader election: returns true if this instance acquired/holds the lock. */
  async tryAcquireLeader(pollId: number, instanceId: string, ttlSeconds = 15): Promise<boolean> {
    const res = await this.redis.set(keys.aggLeader(pollId), instanceId, { nx: true, ex: ttlSeconds });
    if (res === 'OK') return true;
    const holder = await this.redis.get<string>(keys.aggLeader(pollId));
    if (holder === instanceId) {
      await this.redis.expire(keys.aggLeader(pollId), ttlSeconds); // renew
      return true;
    }
    return false;
  }
}

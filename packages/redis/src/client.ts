import { Redis } from '@upstash/redis';

let _redis: Redis | undefined;

/** Upstash Redis REST client (serverless-safe; one per process). */
export function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

/** Key namespace — mirrors poll_tally PK shape so Redis↔Postgres reconciliation is a 1:1 map. */
export const keys = {
  votedBit: (pollId: number, voterId: string) => `voted:${pollId}:${voterId}`,
  optionShard: (pollId: number, optionId: number, shard: number) =>
    `poll:${pollId}:opt:${optionId}:s:${shard}`,
  totalShard: (pollId: number, shard: number) => `poll:${pollId}:total:s:${shard}`,
  snapshot: (pollId: number) => `poll:${pollId}:snapshot`,
  dirty: (pollId: number) => `poll:${pollId}:dirty`,
  aggLeader: (pollId: number) => `poll:${pollId}:agg-leader`,
} as const;

/** Number of counter shards per hot key (spreads write contention). */
export const SHARD_COUNT = Number(process.env.REDIS_SHARD_COUNT ?? '16');

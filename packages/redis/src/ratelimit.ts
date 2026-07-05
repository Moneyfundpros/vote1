import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from './client';

/**
 * Tiered rate limiting. `ephemeralCache` lets warm instances short-circuit repeat callers without a
 * Redis round-trip. Tiers are keyed by purpose so a flood on one endpoint can't exhaust another.
 */
export type RateTier = 'vote' | 'votePoll' | 'otp' | 'kycStart' | 'community' | 'api';

const cache = new Map<string, number>();

function build(tier: RateTier): Ratelimit {
  const redis = getRedis();
  const limiters: Record<RateTier, Ratelimit> = {
    vote: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m'), prefix: 'rl:vote', ephemeralCache: cache }),
    votePoll: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5000, '1 s'), prefix: 'rl:votepoll', ephemeralCache: cache }),
    otp: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'rl:otp', ephemeralCache: cache }),
    kycStart: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'rl:kyc', ephemeralCache: cache }),
    community: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 m'), prefix: 'rl:comm', ephemeralCache: cache }),
    api: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, '1 m'), prefix: 'rl:api', ephemeralCache: cache }),
  };
  return limiters[tier];
}

const instances = new Map<RateTier, Ratelimit>();

export class RateLimiter {
  constructor(private readonly tier: RateTier) {}

  async limit(key: string): Promise<{ success: boolean; retryAfter?: number }> {
    let inst = instances.get(this.tier);
    if (!inst) {
      inst = build(this.tier);
      instances.set(this.tier, inst);
    }
    const res = await inst.limit(key);
    return {
      success: res.success,
      retryAfter: res.success ? undefined : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)),
    };
  }
}

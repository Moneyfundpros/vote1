import { CommunityService, CommunityRepoDrizzle } from '@voter/core';
import { RateLimiter } from '@voter/redis';
import { getPublisher } from '@voter/queue';
import { userRepo } from './wiring';

const communityLimiter = new RateLimiter('community');

let _svc: CommunityService | undefined;
export function communityService(): CommunityService {
  if (!_svc) {
    const publisher = getPublisher();
    _svc = new CommunityService({
      repo: new CommunityRepoDrizzle(),
      users: userRepo,
      rateLimit: { limit: (key) => communityLimiter.limit(key) },
      enqueueAutomod: (type, id) => publisher.enqueueAutomod(type, id),
    });
  }
  return _svc;
}

export const communityRepo = new CommunityRepoDrizzle();

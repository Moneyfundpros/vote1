import {
  VoteService,
  VoteRepoDrizzle,
  PollService,
  PollRepoDrizzle,
  type CountersPort,
  type MacPort,
  type QueuePort,
  type RateLimitPort,
  type TurnstilePort,
  type UserRepo,
} from '@voter/core';
import { RedisCounters, RateLimiter } from '@voter/redis';
import { getMacClient, getTurnstile } from '@voter/security';
import { getPublisher } from '@voter/queue';
import { eq } from 'drizzle-orm';
import { profiles, users } from '@voter/db';
import { getWriteDb, readDb } from './db';

/**
 * Composition root — constructs services with concrete adapters. Each adapter structurally satisfies
 * a core port, keeping the domain layer driver-agnostic.
 */

const counters = new RedisCounters();
// Lazy: getMacClient() validates KMS config and throws for local-dev in production (ADR-0004).
// Deferring to first use keeps `next build` page-data collection from failing when KMS isn't set.
let _macClient: ReturnType<typeof getMacClient> | undefined;
const getMac = () => (_macClient ??= getMacClient());
const turnstileClient = getTurnstile();
const userRateLimiter = new RateLimiter('vote');
const pollRateLimiter = new RateLimiter('votePoll');
const publisher = getPublisher();

const countersPort: CountersPort = {
  hasVoted: (pollId, voterId) => counters.hasVoted(pollId, voterId),
  recordVote: (p) => counters.recordVote(p),
};

const macPort: MacPort = { receiptMac: (input) => getMac().receiptMac(input) };

const turnstilePort: TurnstilePort = {
  verify: (token, action, ip) => turnstileClient.verify(token, action, ip),
};

// Per-user and per-poll rate limits share one port via a key prefix convention.
const rateLimitPort: RateLimitPort = {
  limit: (key) => (key.startsWith('vote:poll:') ? pollRateLimiter.limit(key) : userRateLimiter.limit(key)),
};

// JobPublisher implements the full QueuePort.
const queuePort: QueuePort = publisher;

export const userRepo: UserRepo = {
  async getVoterProfile(userId) {
    const rows = await readDb()
      .select({
        kycStatus: users.kycStatus,
        stateCode: profiles.stateCode,
        ageBand: profiles.ageBand,
        demographicsConsent: profiles.demographicsConsent,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      kycStatus: r.kycStatus,
      stateCode: r.stateCode ?? null,
      ageBand: r.ageBand ?? null,
      demographicsConsent: r.demographicsConsent ?? false,
    };
  },
};

let _voteService: VoteService | undefined;
export function voteService(): VoteService {
  if (!_voteService) {
    _voteService = new VoteService({
      votes: new VoteRepoDrizzle(getWriteDb()),
      users: userRepo,
      counters: countersPort,
      mac: macPort,
      turnstile: turnstilePort,
      rateLimit: rateLimitPort,
      queue: queuePort,
    });
  }
  return _voteService;
}

let _pollService: PollService | undefined;
export function pollService(): PollService {
  if (!_pollService) {
    const hashParts = Number(process.env.NATIONAL_POLL_HASH_PARTS ?? '1');
    _pollService = new PollService(new PollRepoDrizzle(getWriteDb()), queuePort, hashParts);
  }
  return _pollService;
}

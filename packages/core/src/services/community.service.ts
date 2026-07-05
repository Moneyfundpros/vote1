import { AppError } from '../errors';
import { Ok, Err, type Result } from '../result';
import type { RateLimitPort, UserRepo } from './ports';
import type { CommunityRepoDrizzle } from '../repositories/community.repo';
import type {
  CommentCreateInput,
  QaAskInput,
  ReportCreateInput,
  ThreadCreateInput,
} from '../validation/community';

export interface CommunityServiceDeps {
  repo: CommunityRepoDrizzle;
  users: UserRepo;
  rateLimit: RateLimitPort;
  /** Enqueue async moderation (toxicity/spam) for created content. */
  enqueueAutomod: (contentType: 'post' | 'thread' | 'qa', contentId: string) => Promise<void>;
}

/**
 * Strip control characters (code points < 0x20 and 0x7F DEL) by char code, avoiding control-char
 * regex literals. The frontend still escapes/sanitizes HTML on render (defense in depth).
 */
function sanitize(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x20 && c !== 0x7f) out += ch;
  }
  return out.trim();
}

/**
 * Community service. Every write requires a KYC-verified human (anti-sockpuppet/astroturf, tied to
 * one-human identity) and is rate-limited; content is sanitized and queued for automod review.
 */
export class CommunityService {
  constructor(private readonly d: CommunityServiceDeps) {}

  private async gate(userId: string): Promise<Result<void>> {
    const profile = await this.d.users.getVoterProfile(userId);
    if (!profile) return Err(new AppError('NOT_FOUND', 'User not found'));
    if (profile.kycStatus !== 'verified') return Err(new AppError('KYC_REQUIRED', 'Verify your identity to participate'));
    const rl = await this.d.rateLimit.limit(`community:${userId}`);
    if (!rl.success) return Err(new AppError('RATE_LIMITED', 'Slow down', { retryAfter: rl.retryAfter }));
    return Ok(undefined);
  }

  async createThread(userId: string, input: ThreadCreateInput): Promise<Result<{ id: string }>> {
    const g = await this.gate(userId);
    if (!g.ok) return g;
    const res = await this.d.repo.createThread(userId, { ...input, title: sanitize(input.title), body: sanitize(input.body) });
    await this.d.enqueueAutomod('thread', res.id);
    return Ok(res);
  }

  async addComment(userId: string, threadId: string, input: CommentCreateInput): Promise<Result<{ id: string }>> {
    const g = await this.gate(userId);
    if (!g.ok) return g;
    const res = await this.d.repo.addComment(threadId, userId, { ...input, body: sanitize(input.body) });
    await this.d.enqueueAutomod('post', res.id);
    return Ok(res);
  }

  async ask(userId: string, input: QaAskInput): Promise<Result<{ id: string }>> {
    const g = await this.gate(userId);
    if (!g.ok) return g;
    const res = await this.d.repo.askQuestion(userId, { ...input, body: sanitize(input.body) });
    await this.d.enqueueAutomod('qa', res.id);
    return Ok(res);
  }

  async report(userId: string, input: ReportCreateInput): Promise<Result<void>> {
    await this.d.repo.file({ reporterId: userId, targetType: input.targetType, targetId: input.targetId, reason: sanitize(input.reason) });
    return Ok(undefined);
  }

  async respondSurvey(userId: string, surveyId: string, answers: unknown): Promise<Result<{ ok: boolean }>> {
    const g = await this.gate(userId);
    if (!g.ok) return g;
    const res = await this.d.repo.respondSurvey(surveyId, userId, answers);
    if (!res.ok) return Err(new AppError('CONFLICT', 'You have already responded to this survey'));
    return Ok(res);
  }
}

import { AppError } from '../errors';
import { Ok, Err, type Result } from '../result';
import type { QueuePort } from './ports';
import type { PollCreateInput, PollUpdateInput } from '../validation/poll';
import type { PollDetail, PollListItem, PollRepoDrizzle } from '../repositories/poll.repo';

/**
 * Poll lifecycle service. Status transitions enforce a valid state machine; opening a poll provisions
 * its votes partition (in the repo), closing it enqueues the freeze-results job. RBAC (admin) is
 * enforced in the route before these methods are called.
 */
export class PollService {
  constructor(
    private readonly repo: PollRepoDrizzle,
    private readonly queue: QueuePort,
    /** Hash sub-partition count for newly opened polls (raise for national headline polls). */
    private readonly defaultHashParts = 1,
  ) {}

  async create(input: PollCreateInput, createdBy: string): Promise<Result<{ id: number }>> {
    return Ok(await this.repo.create(input, createdBy));
  }

  async list(filter: { status?: string; kind?: string; cursor?: number; limit: number }): Promise<PollListItem[]> {
    return this.repo.list(filter);
  }

  async get(id: number): Promise<Result<PollDetail>> {
    const poll = await this.repo.get(id);
    return poll ? Ok(poll) : Err(new AppError('NOT_FOUND', 'Poll not found'));
  }

  async update(id: number, patch: PollUpdateInput): Promise<Result<{ id: number }>> {
    const poll = await this.repo.get(id);
    if (!poll) return Err(new AppError('NOT_FOUND', 'Poll not found'));

    if (patch.status && patch.status !== poll.status) {
      const transition = this.assertTransition(poll, patch.status);
      if (!transition.ok) return transition;
      const hashParts = patch.status === 'open' ? this.defaultHashParts : 1;
      await this.repo.setStatus(id, patch.status, hashParts);
      if (patch.status === 'closed') await this.queue.enqueueFreezeResults(id);
    }

    // Field edits (repo.update only reads title/description/opens_at/closes_at; status handled above).
    if (patch.title || patch.description !== undefined || patch.opensAt || patch.closesAt) {
      await this.repo.update(id, patch);
    }
    return Ok({ id });
  }

  async archive(id: number): Promise<Result<void>> {
    await this.repo.softArchive(id);
    return Ok(undefined);
  }

  private assertTransition(poll: PollDetail, next: string): Result<void> {
    const allowed: Record<string, string[]> = {
      draft: ['scheduled', 'open', 'archived'],
      scheduled: ['open', 'archived'],
      open: ['closed'],
      closed: ['certified', 'archived'],
      certified: ['archived'],
      archived: [],
    };
    if (next === 'open' && poll.options.length < 2) {
      return Err(new AppError('VALIDATION', 'A poll needs at least two options to open'));
    }
    if (!allowed[poll.status]?.includes(next)) {
      return Err(new AppError('CONFLICT', `Cannot move poll from ${poll.status} to ${next}`));
    }
    return Ok(undefined);
  }
}

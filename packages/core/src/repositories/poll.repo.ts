import { and, desc, eq, lt, sql, type WriteDatabase } from '@voter/db';
import { eligibilityRules, pollOptions, polls } from '@voter/db';
import type { PollCreateInput, PollUpdateInput } from '../validation/poll';

export interface PollListItem {
  id: number;
  slug: string;
  title: string;
  kind: string;
  status: string;
  opensAt: Date | null;
  closesAt: Date | null;
}

export interface PollDetail extends PollListItem {
  description: string | null;
  voteType: string;
  maxSelections: number;
  options: { id: number; label: string; position: number; candidateId: string | null }[];
}

/**
 * Poll repository. Creating/opening polls is admin-only (enforced in the route + service). Opening a
 * poll provisions its dedicated `votes` partition via the create_poll_partition() SQL function; a
 * national headline poll passes hashParts > 1 to spread write contention (ADR-0003 / scaling).
 */
export class PollRepoDrizzle {
  constructor(private readonly db: WriteDatabase) {}

  async create(input: PollCreateInput, createdBy: string): Promise<{ id: number }> {
    return this.db.transaction(async (tx) => {
      let eligibilityRuleId: string | null = null;
      if (input.allowedStates && input.allowedStates.length > 0) {
        const [rule] = await tx
          .insert(eligibilityRules)
          .values({ name: `${input.slug}-eligibility`, requiresKyc: true, allowedStates: input.allowedStates })
          .returning({ id: eligibilityRules.id });
        eligibilityRuleId = rule!.id;
      }

      const [poll] = await tx
        .insert(polls)
        .values({
          slug: input.slug,
          title: input.title,
          description: input.description,
          kind: input.kind,
          voteType: input.voteType,
          maxSelections: input.maxSelections,
          opensAt: input.opensAt ?? null,
          closesAt: input.closesAt ?? null,
          resultVisibility: input.resultVisibility,
          eligibilityRuleId,
          createdBy,
        })
        .returning({ id: polls.id });

      await tx.insert(pollOptions).values(
        input.options.map((o, i) => ({
          pollId: poll!.id,
          label: o.label,
          position: i,
          candidateId: o.candidateId ?? null,
          mediaObjectKey: o.mediaObjectKey ?? null,
        })),
      );

      return { id: poll!.id };
    });
  }

  async list(filter: { status?: string; kind?: string; cursor?: number; limit: number }): Promise<PollListItem[]> {
    const conds = [];
    if (filter.status) conds.push(eq(polls.status, filter.status));
    if (filter.kind) conds.push(eq(polls.kind, filter.kind));
    if (filter.cursor) conds.push(lt(polls.id, filter.cursor));
    return this.db
      .select({
        id: polls.id,
        slug: polls.slug,
        title: polls.title,
        kind: polls.kind,
        status: polls.status,
        opensAt: polls.opensAt,
        closesAt: polls.closesAt,
      })
      .from(polls)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(polls.id))
      .limit(filter.limit);
  }

  async get(id: number): Promise<PollDetail | null> {
    const [poll] = await this.db.select().from(polls).where(eq(polls.id, id)).limit(1);
    if (!poll) return null;
    const opts = await this.db
      .select({ id: pollOptions.id, label: pollOptions.label, position: pollOptions.position, candidateId: pollOptions.candidateId })
      .from(pollOptions)
      .where(eq(pollOptions.pollId, id))
      .orderBy(pollOptions.position);
    return {
      id: poll.id,
      slug: poll.slug,
      title: poll.title,
      kind: poll.kind,
      status: poll.status,
      opensAt: poll.opensAt,
      closesAt: poll.closesAt,
      description: poll.description,
      voteType: poll.voteType,
      maxSelections: poll.maxSelections,
      options: opts,
    };
  }

  async update(id: number, patch: PollUpdateInput): Promise<void> {
    await this.db
      .update(polls)
      .set({
        ...(patch.title ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.opensAt ? { opensAt: patch.opensAt } : {}),
        ...(patch.closesAt ? { closesAt: patch.closesAt } : {}),
      })
      .where(eq(polls.id, id));
  }

  /** Set status; when opening, provision the poll's votes partition (hashParts for national polls). */
  async setStatus(id: number, status: string, hashParts = 1): Promise<void> {
    if (status === 'open') {
      await this.db.execute(sql`select create_poll_partition(${id}, ${hashParts})`);
    }
    await this.db.update(polls).set({ status }).where(eq(polls.id, id));
  }

  async softArchive(id: number): Promise<void> {
    await this.db.update(polls).set({ status: 'archived' }).where(eq(polls.id, id));
  }
}

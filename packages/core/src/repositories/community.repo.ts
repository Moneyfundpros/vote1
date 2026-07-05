import { and, desc, eq, getDb, getReplicaDb, lt, sql } from '@voter/db';
import { posts, qaQuestions, reports, surveyResponses, threads } from '@voter/db';
import type { CommentCreateInput, QaAskInput, ThreadCreateInput } from '../validation/community';

/** Community data access (threads/posts/qa/surveys/reports). Writes pooled; lists on the replica. */
export class CommunityRepoDrizzle {
  async listThreads(filter: { pollId?: number; candidateId?: string; cursor?: string; limit: number }): Promise<unknown[]> {
    const conds = [eq(threads.status, 'open')];
    if (filter.pollId) conds.push(eq(threads.pollId, filter.pollId));
    if (filter.candidateId) conds.push(eq(threads.candidateId, filter.candidateId));
    if (filter.cursor) conds.push(lt(threads.id, filter.cursor));
    return getReplicaDb()
      .select({
        id: threads.id,
        title: threads.title,
        authorId: threads.authorId,
        replyCount: threads.replyCount,
        createdAt: threads.createdAt,
      })
      .from(threads)
      .where(and(...conds))
      .orderBy(desc(threads.createdAt))
      .limit(filter.limit);
  }

  async createThread(authorId: string, input: ThreadCreateInput): Promise<{ id: string }> {
    const [t] = await getDb()
      .insert(threads)
      .values({ authorId, title: input.title, pollId: input.pollId ?? null, candidateId: input.candidateId ?? null })
      .returning({ id: threads.id });
    // The opening post carries the body.
    await getDb().insert(posts).values({ threadId: t!.id, authorId, body: input.body });
    return { id: t!.id };
  }

  async getThread(id: string): Promise<{ thread: unknown; comments: unknown[] } | null> {
    const db = getReplicaDb();
    const [thread] = await db.select().from(threads).where(eq(threads.id, id)).limit(1);
    if (!thread) return null;
    const comments = await db
      .select({ id: posts.id, authorId: posts.authorId, body: posts.body, parentPostId: posts.parentPostId, createdAt: posts.createdAt })
      .from(posts)
      .where(and(eq(posts.threadId, id), eq(posts.status, 'visible')))
      .orderBy(posts.createdAt);
    return { thread, comments };
  }

  async addComment(threadId: string, authorId: string, input: CommentCreateInput): Promise<{ id: string }> {
    const [c] = await getDb()
      .insert(posts)
      .values({ threadId, authorId, body: input.body, parentPostId: input.parentId ?? null })
      .returning({ id: posts.id });
    await getDb()
      .update(threads)
      .set({ replyCount: sql`${threads.replyCount} + 1` })
      .where(eq(threads.id, threadId));
    return { id: c!.id };
  }

  async askQuestion(askerId: string, input: QaAskInput): Promise<{ id: string }> {
    const [q] = await getDb()
      .insert(qaQuestions)
      .values({ askerId, body: input.body, candidateId: input.candidateId ?? null, pollId: input.pollId ?? null })
      .returning({ id: qaQuestions.id });
    return { id: q!.id };
  }

  async file(report: { reporterId: string; targetType: string; targetId: string; reason: string }): Promise<void> {
    await getDb().insert(reports).values(report);
  }

  /** One survey response per verified human (DB UNIQUE enforces it). */
  async respondSurvey(surveyId: string, respondentId: string, answers: unknown): Promise<{ ok: boolean }> {
    const inserted = await getDb()
      .insert(surveyResponses)
      .values({ surveyId, respondentId, answers })
      .onConflictDoNothing({ target: [surveyResponses.surveyId, surveyResponses.respondentId] })
      .returning({ id: surveyResponses.id });
    return { ok: inserted.length > 0 };
  }
}

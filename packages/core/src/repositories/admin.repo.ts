import { createHash } from 'node:crypto';
import { desc, eq, getReplicaDb, sql, type WriteDatabase } from '@voter/db';
import { adminActions, auditLog, posts, reports, threads, users } from '@voter/db';

const sha256 = (b: Buffer): Buffer => createHash('sha256').update(b).digest();

type Tx = Parameters<Parameters<WriteDatabase['transaction']>[0]>[0];

/**
 * Admin/oversight repository. All privileged mutations append to the tamper-evident audit_log via
 * appendAudit (serialized with a Postgres advisory lock so concurrent appends can't fork the chain),
 * and mirror to admin_actions in the SAME transaction (no action commits without a chain entry).
 */
export class AdminRepoDrizzle {
  constructor(private readonly db: WriteDatabase) {}

  private async appendAudit(
    tx: Tx,
    e: { eventType: string; actorId?: string | null; subjectRef?: string | null; payload: unknown },
  ): Promise<void> {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('audit_log'))`);
    const [last] = await tx.select({ rowHash: auditLog.rowHash }).from(auditLog).orderBy(desc(auditLog.id)).limit(1);
    const prev = last?.rowHash ?? Buffer.alloc(32);
    const ts = new Date().toISOString();
    const rowHash = sha256(
      Buffer.concat([prev, Buffer.from(`${e.eventType}|${e.subjectRef ?? ''}|${JSON.stringify(e.payload)}|${ts}`)]),
    );
    await tx.insert(auditLog).values({
      eventType: e.eventType,
      actorId: e.actorId ?? null,
      subjectRef: e.subjectRef ?? null,
      payload: e.payload as object,
      prevHash: prev,
      rowHash,
    });
  }

  async overview(): Promise<Record<string, number>> {
    const db = getReplicaDb();
    const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    const [v] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.kycStatus, 'verified'));
    const [open] = await db.select({ n: sql<number>`count(*)::int` }).from(reports).where(eq(reports.status, 'open'));
    return { users: u?.n ?? 0, verifiedUsers: v?.n ?? 0, openReports: open?.n ?? 0 };
  }

  async moderationQueue(limit: number): Promise<unknown[]> {
    return getReplicaDb()
      .select()
      .from(reports)
      .where(eq(reports.status, 'open'))
      .orderBy(desc(reports.severity), desc(reports.createdAt))
      .limit(limit);
  }

  async kycQueue(limit: number): Promise<unknown[]> {
    return getReplicaDb()
      .select({ id: users.id, kycStatus: users.kycStatus, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.kycStatus, 'pending'))
      .limit(limit);
  }

  /** Moderate a reported item: hide content (optional), resolve the report, audit — one transaction. */
  async moderate(params: {
    reportId: string;
    action: 'remove' | 'dismiss' | 'ban';
    moderatorId: string;
    reason: string;
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [report] = await tx.select().from(reports).where(eq(reports.id, params.reportId)).limit(1);
      if (!report) throw new Error('report not found');

      if (params.action === 'remove') {
        if (report.targetType === 'post') {
          await tx.update(posts).set({ status: 'removed' }).where(eq(posts.id, report.targetId));
        } else if (report.targetType === 'thread') {
          await tx.update(threads).set({ status: 'removed' }).where(eq(threads.id, report.targetId));
        }
      } else if (params.action === 'ban') {
        await tx.update(users).set({ status: 'banned' }).where(eq(users.id, report.targetId));
      }

      await tx
        .update(reports)
        .set({ status: params.action === 'dismiss' ? 'dismissed' : 'actioned', resolutionNote: params.reason, assignedTo: params.moderatorId, resolvedAt: new Date() })
        .where(eq(reports.id, params.reportId));

      await tx.insert(adminActions).values({
        adminId: params.moderatorId,
        action: `moderation.${params.action}`,
        targetType: report.targetType,
        targetId: report.targetId,
        reason: params.reason,
      });

      await this.appendAudit(tx, {
        eventType: `moderation.${params.action}`,
        actorId: params.moderatorId,
        subjectRef: `${report.targetType}:${report.targetId}`,
        payload: { reportId: params.reportId, reason: params.reason },
      });
    });
  }
}

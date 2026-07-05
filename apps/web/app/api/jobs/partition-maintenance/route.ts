import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';
import { eq, getDb, polls, sql } from '@voter/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash cron (M13): votes partition lifecycle. Detaches partitions for polls archived long enough
 * (their tally is already certified + exported to B2), freeing the live table. New-poll partitions
 * are created on open (poll.service). DETACH CONCURRENTLY runs outside a transaction.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  try {
    await verifyJob('partition-maintenance', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  const db = getDb();
  const stale = await db
    .select({ id: polls.id })
    .from(polls)
    .where(eq(polls.status, 'archived'))
    .limit(50);

  let detached = 0;
  for (const p of stale) {
    try {
      await db.execute(sql`select detach_poll_partition(${p.id})`);
      detached++;
    } catch {
      // partition may not exist (poll shared the default partition) — skip.
    }
  }
  return NextResponse.json({ data: { detached } });
}

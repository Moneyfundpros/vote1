import { NextResponse } from 'next/server';
import { ResultsRepoDrizzle } from '@voter/core';
import { getPublisher, verifyJob } from '@voter/queue';
import { getRedis } from '@voter/redis';
import { eq, getDb, polls } from '@voter/db';
import { getWriteDb } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash job: certify a closed poll. Takes a freeze-lock (excludes concurrent reconcile), ensures the
 * poll is authoritatively closed, runs a final reconcile, snapshots poll_tally → certified_results
 * (hash-stamped, append-only), marks certified, then enqueues the export build + audit checkpoint.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'freeze-results'>>>;
  try {
    payload = await verifyJob('freeze-results', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  const redis = getRedis();
  const lockKey = `freeze-lock:${payload.pollId}`;
  const got = await redis.set(lockKey, 1, { nx: true, ex: 300 });
  if (got !== 'OK') return NextResponse.json({ data: { skipped: 'already_freezing' } });

  try {
    // Authoritative close first; bust the meta cache so no late vote slips in via stale status.
    await getDb().update(polls).set({ status: 'closed' }).where(eq(polls.id, payload.pollId));
    await redis.del(`poll:${payload.pollId}:meta`);

    const result = await new ResultsRepoDrizzle(getWriteDb()).freeze(payload.pollId);

    const publisher = getPublisher();
    await publisher.publish('export-build', { exportId: `poll-${payload.pollId}`, pollId: payload.pollId, format: 'csv' }, { dedupId: `export:poll-${payload.pollId}` });
    await publisher.publish('audit-checkpoint', { pollId: payload.pollId });

    return NextResponse.json({ data: { certified: true, totalVotes: result.totalVotes, checksum: result.checksum } });
  } finally {
    await redis.del(lockKey);
  }
}

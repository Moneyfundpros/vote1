import { NextResponse } from 'next/server';
import { ResultsRepoDrizzle } from '@voter/core';
import { verifyJob } from '@voter/queue';
import { getRedis } from '@voter/redis';
import { getWriteDb } from '@/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash job: incrementally reconcile poll_tally from votes (watermark detect-and-delta). Skips if a
 * freeze is in progress for the poll (freeze takes the freeze-lock) so the two never race (critique).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'reconcile-counters'>>>;
  try {
    payload = await verifyJob('reconcile-counters', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  const frozen = await getRedis().exists(`freeze-lock:${payload.pollId}`);
  if (frozen) return NextResponse.json({ data: { skipped: 'freezing' } });

  const res = await new ResultsRepoDrizzle(getWriteDb()).incrementalReconcile(payload.pollId);
  return NextResponse.json({ data: res });
}

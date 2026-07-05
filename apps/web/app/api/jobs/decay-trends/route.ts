import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash cron (M13): recompute/decay trending scores (Redis ZSETs) so "hot" discussions and polls
 * reflect recency. Idempotent (recompute). Seam for the trending model.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  try {
    await verifyJob('decay-trends', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }
  // TODO: apply time-decay to trend ZSETs.
  return NextResponse.json({ data: { ok: true } });
}

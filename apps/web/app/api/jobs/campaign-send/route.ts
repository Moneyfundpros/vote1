import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash job: send one batch of a bulk campaign via Brevo, then enqueue the next batch. Flow Control
 * (parallelism/rate) is configured on the publisher so Brevo isn't flooded. Idempotent per batch.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'campaign-send'>>>;
  try {
    payload = await verifyJob('campaign-send', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }
  // TODO: load the batch's recipient segment, send via @voter/email (Brevo), enqueue next batch.
  void payload;
  return NextResponse.json({ data: { ok: true } });
}

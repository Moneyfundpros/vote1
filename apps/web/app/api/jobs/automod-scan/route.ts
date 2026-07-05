import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash job: automod scan of newly created community content (toxicity/spam). On a hit it hides the
 * content and opens a moderation report; otherwise no-op. Idempotent on content id. (Scoring provider
 * integration is a TODO; the seam is here.)
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'automod-scan'>>>;
  try {
    payload = await verifyJob('automod-scan', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }
  // TODO: score content; if toxic → set status='hidden' + insert a moderation report.
  void payload;
  return NextResponse.json({ data: { ok: true } });
}

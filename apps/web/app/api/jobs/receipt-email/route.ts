import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash job: send the post-vote receipt email. Pattern for every /api/jobs/* handler — verify the
 * Upstash signature against the raw body first (401 on failure), then do idempotent work.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'receipt-email'>>>;
  try {
    payload = await verifyJob('receipt-email', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  // TODO: load user email + poll title, render the React Email receipt, send via @voter/email
  // transactional (Resend). Idempotent on receiptId (dedupe key already set at publish time).
  void payload;
  return NextResponse.json({ data: { ok: true } });
}

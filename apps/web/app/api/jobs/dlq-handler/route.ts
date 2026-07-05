import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash failure callback (Upstash-Failure-Callback target for every published job). Records the dead
 * letter and alerts ops. NOTE: this receives QStash's failure envelope, not a signed job body, so it
 * does not use verifyJob; it records minimally and should be IP/secret-guarded at the edge.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let info: unknown = null;
  try {
    info = await req.json();
  } catch {
    /* ignore */
  }
  // TODO: persist to a dead-letter store + page on-call. Keep payloads scrubbed (no raw PII).
  console.error('[dlq] job failed', JSON.stringify(info)?.slice(0, 500));
  return NextResponse.json({ data: { recorded: true } });
}

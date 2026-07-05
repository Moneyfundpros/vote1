import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';
import { candidateMedia, eq, getDb } from '@voter/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * QStash job: validate/scan an uploaded candidate media object, then promote scan_status → 'clean'
 * (or 'rejected'). Heavy transcode/thumbnailing is delegated to the worker; this handler records the
 * scan outcome. Idempotent on objectKey.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'media-process'>>>;
  try {
    payload = await verifyJob('media-process', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }
  // TODO: fetch from B2, run AV/content scan, transcode/thumbnail via the worker. For now mark clean.
  await getDb().update(candidateMedia).set({ scanStatus: 'clean' }).where(eq(candidateMedia.objectKey, payload.objectKey));
  return NextResponse.json({ data: { ok: true } });
}

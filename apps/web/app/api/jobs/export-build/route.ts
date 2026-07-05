import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';
import { certifiedResults, eq, getDb, getReplicaDb, resultExports } from '@voter/db';
import { putObject } from '@voter/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Snapshot {
  total: number;
  options: { optionId: number; count: number }[];
}

/**
 * QStash job: build a hash-stamped result export from the certified snapshot, upload to B2, and
 * register it in result_exports so the public can recompute the SHA-256 and match. Idempotent on key.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'export-build'>>>;
  try {
    payload = await verifyJob('export-build', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  const [cert] = await getReplicaDb()
    .select({ snapshot: certifiedResults.snapshot })
    .from(certifiedResults)
    .where(eq(certifiedResults.pollId, payload.pollId))
    .limit(1);
  if (!cert) return NextResponse.json({ data: { skipped: 'not_certified' } });

  const snap = cert.snapshot as Snapshot;
  const body =
    payload.format === 'csv'
      ? ['option_id,count', ...snap.options.map((o) => `${o.optionId},${o.count}`), `total,${snap.total}`].join('\n')
      : JSON.stringify(snap);
  const checksum = createHash('sha256').update(body).digest();
  const objectKey = `exports/poll-${payload.pollId}.${payload.format}`;

  await putObject({ bucket: 'exports', key: objectKey, body, contentType: payload.format === 'csv' ? 'text/csv' : 'application/json' });
  await getDb()
    .insert(resultExports)
    .values({ pollId: payload.pollId, kind: 'certified', objectKey, checksum, byteSize: Buffer.byteLength(body), builtByJob: payload.exportId });

  return NextResponse.json({ data: { objectKey, checksum: checksum.toString('hex') } });
}

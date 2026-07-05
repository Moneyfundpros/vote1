import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';
import { and, asc, auditAnchors, desc, eq, getDb, getReplicaDb, gt, votes } from '@voter/db';
import { buildMerkle, leafCommitment } from '@voter/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH = Number(process.env.AUDIT_BATCH ?? '100000');

/**
 * QStash job: Merkle batch anchoring (ADR-0003). Anchors votes committed since the last checkpoint
 * for a poll: builds opaque leaf commitments, a Merkle root, and appends ONE audit_anchors row that
 * chains to the previous root. No inline per-row chain on the hot write path; no raw tuples published.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  let payload: Awaited<ReturnType<typeof verifyJob<'audit-checkpoint'>>>;
  try {
    payload = await verifyJob('audit-checkpoint', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }
  const pollId = payload.pollId;
  if (!pollId) return NextResponse.json({ data: { skipped: 'no_poll' } });

  const read = getReplicaDb();
  const [last] = await read
    .select({ batchToId: auditAnchors.batchToId, merkleRoot: auditAnchors.merkleRoot })
    .from(auditAnchors)
    .where(eq(auditAnchors.pollId, pollId))
    .orderBy(desc(auditAnchors.id))
    .limit(1);
  const watermark = last?.batchToId ?? 0;

  const rows = await read
    .select({ id: votes.id, voterId: votes.voterId, optionId: votes.optionId })
    .from(votes)
    .where(and(eq(votes.pollId, pollId), gt(votes.id, watermark)))
    .orderBy(asc(votes.id))
    .limit(BATCH);

  if (rows.length === 0) return NextResponse.json({ data: { nothingToAnchor: true } });

  const leaves = rows.map((r) => leafCommitment(pollId, r.voterId, r.optionId, r.id));
  const { root } = buildMerkle(leaves);

  await getDb()
    .insert(auditAnchors)
    .values({
      pollId,
      batchFromId: rows[0]!.id,
      batchToId: rows[rows.length - 1]!.id,
      leafCount: rows.length,
      merkleRoot: root,
      prevRoot: last?.merkleRoot ?? null,
    });

  // TODO: publish root to an external immutable log (OpenTimestamps / public git) → externalAnchorRef.
  return NextResponse.json({ data: { anchored: rows.length, root: root.toString('hex') } });
}

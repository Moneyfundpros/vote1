import { NextResponse } from 'next/server';
import { AuditRepoDrizzle, zPollId } from '@voter/core';

export const runtime = 'nodejs';

const repo = new AuditRepoDrizzle();

/**
 * GET /api/audit/inclusion?pollId=&commitment= — Merkle inclusion proof for a leaf commitment.
 * Returns sibling hashes + the anchored root only; never raw (voter, option) tuples (ballot secrecy).
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const pollId = zPollId.safeParse(url.searchParams.get('pollId') ?? undefined);
  const commitment = url.searchParams.get('commitment') ?? '';
  if (!pollId.success || !/^[0-9a-fA-F]{64}$/.test(commitment)) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'pollId and 32-byte commitment required' } }, { status: 422 });
  }
  const result = await repo.inclusionProof(pollId.data, commitment);
  if (!result.found) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Commitment not anchored' } }, { status: 404 });
  return NextResponse.json({ data: result });
}

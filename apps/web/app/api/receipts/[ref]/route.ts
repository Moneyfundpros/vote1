import { NextResponse } from 'next/server';
import { eq, getReplicaDb, voteReceipts } from '@voter/db';

export const runtime = 'nodejs';

/**
 * GET /api/receipts/[ref] — public receipt verification (ADR-0002). The ref is the hex of the
 * receipt_hash. Confirms a vote was cast and counted for a poll WITHOUT revealing who or what:
 * never returns voter_id or option_id (ballot secrecy). Served from the read replica.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ ref: string }> }): Promise<NextResponse> {
  const { ref } = await ctx.params;
  if (!/^[0-9a-fA-F]{32,128}$/.test(ref)) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid receipt' } }, { status: 422 });
  }
  const rows = await getReplicaDb()
    .select({ pollId: voteReceipts.pollId, castAt: voteReceipts.castAt })
    .from(voteReceipts)
    .where(eq(voteReceipts.receiptHash, Buffer.from(ref, 'hex')))
    .limit(1);

  const r = rows[0];
  if (!r) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Receipt not found' } }, { status: 404 });
  return NextResponse.json({ data: { valid: true, pollId: r.pollId, recordedAt: r.castAt } });
}

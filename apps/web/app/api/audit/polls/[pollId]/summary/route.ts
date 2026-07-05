import { NextResponse } from 'next/server';
import { AuditRepoDrizzle, zPollId } from '@voter/core';

export const runtime = 'nodejs';

const repo = new AuditRepoDrizzle();

/** GET /api/audit/polls/[pollId]/summary — public integrity summary (no per-voter data). */
export async function GET(_req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  const pollId = zPollId.safeParse((await ctx.params).pollId);
  if (!pollId.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });
  const s = await repo.summary(pollId.data);
  if (!s) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not yet certified' } }, { status: 404 });
  return NextResponse.json({ data: s });
}

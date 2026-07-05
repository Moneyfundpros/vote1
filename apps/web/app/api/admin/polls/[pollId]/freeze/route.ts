import { NextResponse } from 'next/server';
import { zPollId } from '@voter/core';
import { getPublisher } from '@voter/queue';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/admin/polls/[pollId]/freeze — trigger the certified-tally freeze job (admin). */
export async function POST(_req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const pollId = zPollId.safeParse((await ctx.params).pollId);
    if (!pollId.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });
    await getPublisher().enqueueFreezeResults(pollId.data);
    return NextResponse.json({ data: { enqueued: true } }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}

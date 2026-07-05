import { NextResponse } from 'next/server';
import { zUuid } from '@voter/core';
import { communityRepo } from '@/server/community-wiring';

export const runtime = 'nodejs';

/** GET /api/community/threads/[id] — thread + visible comments (public). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const id = zUuid.safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid id' } }, { status: 422 });
  const t = await communityRepo.getThread(id.data);
  if (!t) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Thread not found' } }, { status: 404 });
  return NextResponse.json({ data: t });
}

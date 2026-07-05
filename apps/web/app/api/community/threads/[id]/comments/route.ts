import { NextResponse } from 'next/server';
import { commentCreateSchema, zUuid } from '@voter/core';
import { communityService } from '@/server/community-wiring';
import { requireSession } from '@/server/guard';
import { handleError, respond } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/community/threads/[id]/comments — reply (KYC-gated, rate-limited). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const p = await requireSession();
    const id = zUuid.safeParse((await ctx.params).id);
    if (!id.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid id' } }, { status: 422 });
    const parsed = commentCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid comment' } }, { status: 422 });
    return respond(await communityService().addComment(p.id, id.data, parsed.data), 201);
  } catch (e) {
    return handleError(e);
  }
}

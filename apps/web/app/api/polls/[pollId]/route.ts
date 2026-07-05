import { NextResponse } from 'next/server';
import { pollUpdateSchema, zPollId } from '@voter/core';
import { pollService } from '@/server/wiring';
import { requireRole } from '@/server/guard';
import { handleError, respond } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/polls/[pollId] — poll detail (public). */
export async function GET(_req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  const pollId = zPollId.safeParse((await ctx.params).pollId);
  if (!pollId.success) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });
  }
  return respond(await pollService().get(pollId.data));
}

/** PATCH /api/polls/[pollId] — edit/open/close/certify (admin). Opening provisions the partition. */
export async function PATCH(req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const pollId = zPollId.safeParse((await ctx.params).pollId);
    if (!pollId.success) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });
    }
    const parsed = pollUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid patch' } }, { status: 422 });
    }
    return respond(await pollService().update(pollId.data, parsed.data));
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/polls/[pollId] — soft archive (admin). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const pollId = zPollId.safeParse((await ctx.params).pollId);
    if (!pollId.success) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });
    }
    await pollService().archive(pollId.data);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return handleError(e);
  }
}

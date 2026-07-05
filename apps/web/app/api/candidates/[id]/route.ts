import { NextResponse } from 'next/server';
import { candidateUpdateSchema, CandidateRepoDrizzle, zUuid } from '@voter/core';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const repo = new CandidateRepoDrizzle();

/** GET /api/candidates/[id] — full profile: bio, manifesto, positions, promises, clean media (public). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const id = zUuid.safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid id' } }, { status: 422 });
  const c = await repo.get(id.data);
  if (!c) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Candidate not found' } }, { status: 404 });
  return NextResponse.json({ data: c });
}

/** PATCH /api/candidates/[id] — update (admin). */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const id = zUuid.safeParse((await ctx.params).id);
    if (!id.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid id' } }, { status: 422 });
    const parsed = candidateUpdateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid patch' } }, { status: 422 });
    await repo.update(id.data, parsed.data);
    return NextResponse.json({ data: { id: id.data } });
  } catch (e) {
    return handleError(e);
  }
}

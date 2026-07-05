import { NextResponse } from 'next/server';
import { candidateCreateSchema, CandidateRepoDrizzle, zLimit } from '@voter/core';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const repo = new CandidateRepoDrizzle();

/** GET /api/candidates — search/list the candidate hub (public). */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = zLimit.parse(url.searchParams.get('limit') ?? undefined);
  const items = await repo.list({
    office: url.searchParams.get('office') ?? undefined,
    party: url.searchParams.get('party') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit,
  });
  const nextCursor = items.length === limit ? items[items.length - 1]!.id : null;
  return NextResponse.json({ data: items, meta: { nextCursor } });
}

/** POST /api/candidates — create (admin). */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const parsed = candidateCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid candidate' } }, { status: 422 });
    }
    const res = await repo.create(parsed.data);
    return NextResponse.json({ data: res }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

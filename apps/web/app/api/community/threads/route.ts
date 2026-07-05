import { NextResponse } from 'next/server';
import { threadCreateSchema, zLimit } from '@voter/core';
import { communityRepo, communityService } from '@/server/community-wiring';
import { requireSession } from '@/server/guard';
import { handleError, respond } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/community/threads — list discussions (public). */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = zLimit.parse(url.searchParams.get('limit') ?? undefined);
  const pollId = url.searchParams.get('pollId');
  const items = await communityRepo.listThreads({
    pollId: pollId ? Number(pollId) : undefined,
    candidateId: url.searchParams.get('candidateId') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit,
  });
  return NextResponse.json({ data: items });
}

/** POST /api/community/threads — start a discussion (KYC-gated, rate-limited). */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const p = await requireSession();
    const parsed = threadCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid thread' } }, { status: 422 });
    return respond(await communityService().createThread(p.id, parsed.data), 201);
  } catch (e) {
    return handleError(e);
  }
}

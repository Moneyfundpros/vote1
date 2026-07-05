import { NextResponse } from 'next/server';
import { reportCreateSchema } from '@voter/core';
import { communityService } from '@/server/community-wiring';
import { requireSession } from '@/server/guard';
import { handleError, respond } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/community/reports — flag content for moderation. */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const p = await requireSession();
    const parsed = reportCreateSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid report' } }, { status: 422 });
    return respond(await communityService().report(p.id, parsed.data), 201);
  } catch (e) {
    return handleError(e);
  }
}

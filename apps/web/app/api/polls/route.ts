import { NextResponse } from 'next/server';
import { pollCreateSchema, zLimit } from '@voter/core';
import { pollService } from '@/server/wiring';
import { requireRole } from '@/server/guard';
import { handleError, respond } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/polls — list (public). Filters: status, kind, cursor, limit. */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = zLimit.parse(url.searchParams.get('limit') ?? undefined);
  const cursor = url.searchParams.get('cursor');
  const items = await pollService().list({
    status: url.searchParams.get('status') ?? undefined,
    kind: url.searchParams.get('kind') ?? undefined,
    cursor: cursor ? Number(cursor) : undefined,
    limit,
  });
  const nextCursor = items.length === limit ? String(items[items.length - 1]!.id) : null;
  return NextResponse.json({ data: items, meta: { nextCursor } });
}

/** POST /api/polls — create (admin only). */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    const admin = await requireRole('admin');
    const parsed = pollCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION', message: 'Invalid poll', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 },
      );
    }
    return respond(await pollService().create(parsed.data, admin.id), 201);
  } catch (e) {
    return handleError(e);
  }
}

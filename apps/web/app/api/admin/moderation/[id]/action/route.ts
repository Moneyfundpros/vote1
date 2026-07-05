import { NextResponse } from 'next/server';
import { z } from 'zod';
import { zUuid } from '@voter/core';
import { adminRepo } from '@/server/admin-wiring';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const actionSchema = z.object({ action: z.enum(['remove', 'dismiss', 'ban']), reason: z.string().min(3).max(1000) });

/** POST /api/admin/moderation/[id]/action — resolve a report; audited in the same tx (admin/moderator). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const p = await requireRole('admin', 'moderator');
    const id = zUuid.safeParse((await ctx.params).id);
    if (!id.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid id' } }, { status: 422 });
    const parsed = actionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid action' } }, { status: 422 });
    await adminRepo().moderate({ reportId: id.data, action: parsed.data.action, moderatorId: p.id, reason: parsed.data.reason });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return handleError(e);
  }
}

import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPublisher } from '@voter/queue';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const campaignSchema = z.object({
  segment: z.string().min(1),
  channel: z.enum(['email', 'sms']),
  templateId: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

/** POST /api/admin/campaigns — launch a bulk Brevo campaign via QStash Flow Control (admin). */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const parsed = campaignSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid campaign' } }, { status: 422 });
    const campaignId = randomUUID();
    await getPublisher().publish('campaign-send', { campaignId, batch: 0 }, { dedupId: `campaign:${campaignId}:0` });
    return NextResponse.json({ data: { campaignId } }, { status: 202 });
  } catch (e) {
    return handleError(e);
  }
}

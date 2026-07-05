import { NextResponse } from 'next/server';
import { zLimit } from '@voter/core';
import { adminRepo } from '@/server/admin-wiring';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/kyc/queue — pending verification review (coarse data only; no raw PII). */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const limit = zLimit.parse(new URL(req.url).searchParams.get('limit') ?? undefined);
    return NextResponse.json({ data: await adminRepo().kycQueue(limit) });
  } catch (e) {
    return handleError(e);
  }
}

import { NextResponse } from 'next/server';
import { adminRepo } from '@/server/admin-wiring';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/overview — ops metrics (admin/analyst). */
export async function GET(): Promise<NextResponse> {
  try {
    await requireRole('admin', 'analyst');
    return NextResponse.json({ data: await adminRepo().overview() });
  } catch (e) {
    return handleError(e);
  }
}

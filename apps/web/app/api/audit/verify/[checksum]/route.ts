import { NextResponse } from 'next/server';
import { AuditRepoDrizzle } from '@voter/core';

export const runtime = 'nodejs';

const repo = new AuditRepoDrizzle();

/** GET /api/audit/verify/[checksum] — confirm a published SHA-256 matches a certified result. */
export async function GET(_req: Request, ctx: { params: Promise<{ checksum: string }> }): Promise<NextResponse> {
  const { checksum } = await ctx.params;
  if (!/^[0-9a-fA-F]{64}$/.test(checksum)) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid checksum' } }, { status: 422 });
  }
  return NextResponse.json({ data: await repo.verifyChecksum(checksum) });
}

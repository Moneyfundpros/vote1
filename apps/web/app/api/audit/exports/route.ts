import { NextResponse } from 'next/server';
import { AuditRepoDrizzle } from '@voter/core';
import { presignDownload } from '@voter/storage';

export const runtime = 'nodejs';

const repo = new AuditRepoDrizzle();

/** GET /api/audit/exports?pollId= — list published, hash-stamped exports with presigned download URLs. */
export async function GET(req: Request): Promise<NextResponse> {
  const pollIdRaw = new URL(req.url).searchParams.get('pollId');
  const pollId = pollIdRaw ? Number(pollIdRaw) : undefined;
  const exports = await repo.listExports(pollId);
  const data = await Promise.all(
    exports.map(async (e) => ({
      ...e,
      downloadUrl: await presignDownload({ bucket: 'exports', key: e.objectKey, expiresIn: 120 }),
    })),
  );
  return NextResponse.json({ data });
}

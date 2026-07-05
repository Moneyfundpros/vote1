import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CandidateRepoDrizzle, mediaPresignSchema } from '@voter/core';
import { presignUpload } from '@voter/storage';
import { getPublisher } from '@voter/queue';
import { requireRole } from '@/server/guard';
import { handleError } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const repo = new CandidateRepoDrizzle();
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

/**
 * POST /api/media/presign-upload — presign a candidate media upload to Backblaze B2 (admin).
 * Content-type + size validated before signing; the object is registered pending scan, then the
 * media-process job promotes it to 'clean'.
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    await requireRole('admin');
    const parsed = mediaPresignSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid request' } }, { status: 422 });
    }
    const { candidateId, contentType } = parsed.data;
    const objectKey = `candidates/${candidateId}/${randomUUID()}.${EXT[contentType]}`;
    const { uploadUrl } = await presignUpload({ bucket: 'uploads', key: objectKey, contentType });

    const mediaType = contentType.startsWith('image') ? 'image' : contentType.startsWith('video') ? 'video' : 'pdf';
    await repo.addMedia({ candidateId, objectKey, mediaType, contentType });
    await getPublisher().publish('media-process', { objectKey, candidateId }, { dedupId: objectKey });

    return NextResponse.json({ data: { uploadUrl, objectKey, expiresAt: new Date(Date.now() + 300_000).toISOString() } });
  } catch (e) {
    return handleError(e);
  }
}

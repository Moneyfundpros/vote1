import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Backblaze B2 via the S3-compatible API. Buckets: voter-media (public, Cloudflare-proxied),
 * voter-exports (private), voter-uploads (private staging). Store object KEYS in the DB, never signed
 * URLs. Public media is served through Cloudflare for free egress, never proxied via Vercel.
 */
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']);

export const buckets = {
  media: process.env.B2_BUCKET_MEDIA ?? 'voter-media',
  exports: process.env.B2_BUCKET_EXPORTS ?? 'voter-exports',
  uploads: process.env.B2_BUCKET_UPLOADS ?? 'voter-uploads',
} as const;

function s3(opts?: { downloadOnly?: boolean }): S3Client {
  const keyId = opts?.downloadOnly ? process.env.B2_DOWNLOAD_KEY_ID : process.env.B2_KEY_ID;
  const secret = opts?.downloadOnly ? process.env.B2_DOWNLOAD_KEY : process.env.B2_APP_KEY;
  return new S3Client({
    endpoint: process.env.B2_S3_ENDPOINT,
    region: process.env.B2_REGION ?? 'eu-central-003',
    credentials: { accessKeyId: keyId ?? '', secretAccessKey: secret ?? '' },
    forcePathStyle: true,
  });
}

export interface PresignUploadParams {
  bucket: keyof typeof buckets;
  key: string;
  contentType: string;
  expiresIn?: number;
}

export async function presignUpload(params: PresignUploadParams): Promise<{ uploadUrl: string; objectKey: string }> {
  if (!ALLOWED_UPLOAD_TYPES.has(params.contentType)) {
    throw new Error(`content-type ${params.contentType} not allowed`);
  }
  const cmd = new PutObjectCommand({
    Bucket: buckets[params.bucket],
    Key: params.key,
    ContentType: params.contentType,
  });
  const uploadUrl = await getSignedUrl(s3(), cmd, { expiresIn: params.expiresIn ?? 300 });
  return { uploadUrl, objectKey: params.key };
}

export async function presignDownload(params: {
  bucket: keyof typeof buckets;
  key: string;
  expiresIn?: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: buckets[params.bucket], Key: params.key });
  return getSignedUrl(s3({ downloadOnly: true }), cmd, { expiresIn: params.expiresIn ?? 120 });
}

/** Server-side upload (hash-stamped audit/result exports). Caller computes the checksum separately. */
export async function putObject(params: {
  bucket: keyof typeof buckets;
  key: string;
  body: Buffer | string;
  contentType: string;
}): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: buckets[params.bucket],
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}

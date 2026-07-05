import { NextResponse } from 'next/server';
import { providerByName } from '@voter/kyc';
import { verificationService } from '@/server/verification-wiring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/kyc/[provider] — inbound KYC provider callback.
 *
 * SECURITY/PRIVACY (NDPA, ADR-0004): read the RAW body for HMAC verification, then parse to a typed
 * coarse object and extract the raw NIN/BVN into a single local that is handed straight to the
 * verification service (which MACs it inside the KMS and discards it). The raw id is NEVER persisted,
 * logged, or returned. This route is on the Sentry/pino deny-by-default list.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }): Promise<NextResponse> {
  const { provider: providerName } = await ctx.params;
  const provider = providerByName(providerName);

  const raw = await req.text();
  const signature = req.headers.get('x-dojah-signature') ?? req.headers.get('x-smileid-signature');
  if (!provider.verifyWebhook(raw, signature)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  // Parse to a typed shape. The raw id lives only in `idValue` for this frame.
  const p = JSON.parse(raw) as {
    reference_id?: string;
    referenceId?: string;
    user_id?: string;
    status?: string;
    id_type?: 'nin' | 'bvn';
    id_value?: string; // raw NIN/BVN from the verified provider payload (transient)
    face_match?: boolean;
  };
  const providerRef = p.reference_id ?? p.referenceId;
  const userId = p.user_id;
  const idType = p.id_type;
  const idValue = p.id_value;
  if (!providerRef || !userId || !idType || !idValue) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Missing fields' } }, { status: 422 });
  }

  const result = await verificationService().finalize({
    userId,
    provider: provider.name,
    providerRef,
    idType,
    rawId: idValue,
    faceMatch: p.face_match ?? false,
    verified: p.status === 'verified' || p.status === 'approved',
  });

  if (!result.ok) return NextResponse.json(result.error.toBody(), { status: result.error.status });
  return NextResponse.json({ data: { ok: true, outcome: result.value } });
}

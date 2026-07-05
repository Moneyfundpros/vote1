import { createHmac, timingSafeEqual } from 'node:crypto';
import type { KycProvider, KycResult, LivenessInput, LookupInput } from './provider';

/**
 * Dojah adapter (PRIMARY). Uses Dojah's KYC APIs for NIN/BVN lookup and biometric/liveness.
 * Endpoints/paths are configurable; treat published shapes as defaults to confirm against live docs.
 */
export class DojahProvider implements KycProvider {
  readonly name = 'dojah' as const;
  private readonly appId = process.env.DOJAH_APP_ID ?? '';
  private readonly apiKey = process.env.DOJAH_API_KEY ?? '';
  private readonly base = process.env.DOJAH_BASE_URL ?? 'https://api.dojah.io';

  private headers(): HeadersInit {
    return { Authorization: this.apiKey, AppId: this.appId, 'content-type': 'application/json' };
  }

  async lookup(input: LookupInput): Promise<KycResult> {
    const path = input.idType === 'nin' ? '/api/v1/kyc/nin' : '/api/v1/kyc/bvn';
    const param = input.idType === 'nin' ? 'nin' : 'bvn';
    const res = await fetch(`${this.base}${path}?${param}=${encodeURIComponent(input.idValue)}`, {
      headers: this.headers(),
    });
    const ref = res.headers.get('x-reference-id') ?? `DJ-${Date.now()}`;
    if (!res.ok) return { verified: false, providerRef: ref, reason: `lookup_${res.status}` };
    // We deliberately do NOT read or return name/DOB/photo from the entity payload.
    return { verified: true, providerRef: ref };
  }

  async liveness(input: LivenessInput): Promise<KycResult> {
    const res = await fetch(`${this.base}/api/v1/kyc/photoid/verify`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ reference_id: input.sessionRef }),
    });
    const ref = input.sessionRef;
    if (!res.ok) return { verified: false, faceMatch: false, providerRef: ref, reason: `liveness_${res.status}` };
    const data = (await res.json()) as { entity?: { selfie_verification?: { match?: boolean } } };
    const match = data.entity?.selfie_verification?.match ?? false;
    return { verified: match, faceMatch: match, providerRef: ref, reason: match ? undefined : 'face_mismatch' };
  }

  verifyWebhook(rawBody: string, signature: string | null): boolean {
    const secret = process.env.DOJAH_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

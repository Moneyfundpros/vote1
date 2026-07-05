import { createHmac, timingSafeEqual } from 'node:crypto';
import type { KycProvider, KycResult, LivenessInput, LookupInput } from './provider';

/**
 * Smile ID adapter (FALLBACK). A genuinely different rail (independent NIMC + CBN backing) for
 * failover and fraud-spike re-checks. Implemented to the same port; wire real Smile ID signature/SDK
 * calls in place of the placeholders below before production.
 */
export class SmileIdProvider implements KycProvider {
  readonly name = 'smileid' as const;
  private readonly partnerId = process.env.SMILEID_PARTNER_ID ?? '';
  private readonly apiKey = process.env.SMILEID_API_KEY ?? '';
  private readonly base = process.env.SMILEID_BASE_URL ?? 'https://api.smileidentity.com';

  async lookup(input: LookupInput): Promise<KycResult> {
    const res = await fetch(`${this.base}/v1/id_verification`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
      body: JSON.stringify({
        partner_id: this.partnerId,
        country: 'NG',
        id_type: input.idType.toUpperCase(),
        id_number: input.idValue,
      }),
    });
    const ref = `SM-${Date.now()}`;
    if (!res.ok) return { verified: false, providerRef: ref, reason: `lookup_${res.status}` };
    return { verified: true, providerRef: ref };
  }

  async liveness(input: LivenessInput): Promise<KycResult> {
    // Smile ID's SmartSelfie job result is delivered by callback; here we accept the session ref.
    return { verified: true, faceMatch: true, providerRef: input.sessionRef };
  }

  verifyWebhook(rawBody: string, signature: string | null): boolean {
    const secret = process.env.SMILEID_CALLBACK_SECRET;
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

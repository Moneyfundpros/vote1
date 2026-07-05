import { getMacClient, normalizeGovId } from '@voter/security';
import { DojahProvider } from './dojah';
import { SmileIdProvider } from './smileid';
import type { KycProvider, KycResult, LivenessInput, LookupInput } from './provider';

export type { KycProvider, KycResult, LivenessInput, LookupInput, KycTier } from './provider';
export { DojahProvider, SmileIdProvider };

/**
 * Provider router with a simple circuit breaker: when the primary's recent failure rate trips the
 * threshold, route to the fallback. (Production should persist breaker state in Redis so it is shared
 * across serverless instances; this in-memory version is a starting point.)
 */
class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(
    private readonly threshold = 5,
    private readonly cooldownMs = 30_000,
  ) {}
  get open(): boolean {
    if (this.failures < this.threshold) return false;
    if (Date.now() - this.openedAt > this.cooldownMs) {
      this.failures = 0; // half-open: allow a retry
      return false;
    }
    return true;
  }
  record(ok: boolean): void {
    if (ok) {
      this.failures = 0;
    } else if (++this.failures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }
}

const providers: Record<string, KycProvider> = {
  dojah: new DojahProvider(),
  smileid: new SmileIdProvider(),
};
const breaker = new CircuitBreaker();

function primary(): KycProvider {
  return providers[process.env.KYC_PROVIDER_PRIMARY ?? 'dojah'] ?? providers.dojah!;
}
function fallback(): KycProvider {
  return providers[process.env.KYC_PROVIDER_FALLBACK ?? 'smileid'] ?? providers.smileid!;
}

export function providerByName(name: string): KycProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown KYC provider ${name}`);
  return p;
}

async function withFailover(run: (p: KycProvider) => Promise<KycResult>): Promise<KycResult> {
  const chosen = breaker.open ? fallback() : primary();
  try {
    const result = await run(chosen);
    breaker.record(result.verified || result.reason?.startsWith('face') === true);
    return result;
  } catch {
    breaker.record(false);
    // One failover attempt to the other rail.
    const other = chosen.name === primary().name ? fallback() : primary();
    return run(other);
  }
}

export const kyc = {
  lookup: (input: LookupInput) => withFailover((p) => p.lookup(input)),
  liveness: (input: LivenessInput) => withFailover((p) => p.liveness(input)),
};

/**
 * Privacy-safe one-human dedup key (ADR-0004). The raw NIN/BVN is normalized and MAC'd inside the
 * KMS — this process never holds the pepper. The returned digest is what we store in identity_dedup.
 */
export async function deriveDedupKey(idType: 'nin' | 'bvn', rawIdValue: string): Promise<Buffer> {
  const mac = getMacClient();
  // idType is folded into the preimage so a NIN and a BVN with the same digits never collide.
  return mac.mac('dedup', Buffer.concat([Buffer.from(`${idType}:`), normalizeGovId(rawIdValue)]));
}

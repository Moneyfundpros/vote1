import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Keyed MAC client (ADR-0004). For low-entropy inputs (NIN ~37 bits, phone, IP) the keying secret
 * MUST NOT live in the app runtime. In production the MAC is computed inside a KMS/HSM (`GenerateMac`)
 * so the app sends the preimage and receives the digest but never holds the pepper.
 *
 * `local-dev` uses an in-process HMAC with DEV_LOCAL_PEPPER and is refused when NODE_ENV=production.
 */

export type MacPurpose = 'dedup' | 'phone' | 'receipt' | 'risk';

export interface MacClient {
  mac(purpose: MacPurpose, input: Buffer): Promise<Buffer>;
  /** Constant-time compare two digests. */
  equal(a: Buffer, b: Buffer): boolean;
  /** Convenience for the vote receipt path (core MacPort). */
  receiptMac(input: Buffer): Promise<Buffer>;
}

interface MacConfig {
  provider: 'aws' | 'gcp' | 'vault' | 'local-dev';
  keyIds: Record<MacPurpose, string | undefined>;
  keyVersion: number;
  devPepper?: string;
}

function loadConfig(): MacConfig {
  const provider = (process.env.KMS_PROVIDER ?? 'local-dev') as MacConfig['provider'];
  if (provider === 'local-dev' && process.env.NODE_ENV === 'production') {
    throw new Error('KMS_PROVIDER=local-dev is forbidden in production (ADR-0004)');
  }
  return {
    provider,
    keyIds: {
      dedup: process.env.KMS_DEDUP_KEY_ID,
      phone: process.env.KMS_PHONE_KEY_ID,
      receipt: process.env.KMS_RECEIPT_KEY_ID,
      risk: process.env.KMS_RISK_KEY_ID,
    },
    keyVersion: Number(process.env.PEPPER_KEY_VERSION ?? '1'),
    devPepper: process.env.DEV_LOCAL_PEPPER,
  };
}

class LocalDevMac implements MacClient {
  constructor(private readonly cfg: MacConfig) {}
  async mac(purpose: MacPurpose, input: Buffer): Promise<Buffer> {
    const pepper = this.cfg.devPepper ?? 'insecure-dev-pepper-do-not-use-in-prod';
    return createHmac('sha256', `${pepper}:${purpose}:v${this.cfg.keyVersion}`).update(input).digest();
  }
  equal(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
  }
  receiptMac(input: Buffer): Promise<Buffer> {
    return this.mac('receipt', input);
  }
}

class AwsKmsMac implements MacClient {
  constructor(private readonly cfg: MacConfig) {}
  async mac(purpose: MacPurpose, input: Buffer): Promise<Buffer> {
    const keyId = this.cfg.keyIds[purpose];
    if (!keyId) throw new Error(`No KMS key id configured for MAC purpose '${purpose}'`);
    // Lazy import keeps the AWS SDK out of cold-start paths that never MAC.
    const { KMSClient, GenerateMacCommand } = await import('@aws-sdk/client-kms');
    const client = new KMSClient({});
    const out = await client.send(
      new GenerateMacCommand({ KeyId: keyId, MacAlgorithm: 'HMAC_SHA_256', Message: input }),
    );
    if (!out.Mac) throw new Error('KMS GenerateMac returned no Mac');
    return Buffer.from(out.Mac);
  }
  equal(a: Buffer, b: Buffer): boolean {
    return a.length === b.length && timingSafeEqual(a, b);
  }
  receiptMac(input: Buffer): Promise<Buffer> {
    return this.mac('receipt', input);
  }
}

let _client: MacClient | undefined;

export function getMacClient(): MacClient {
  if (_client) return _client;
  const cfg = loadConfig();
  switch (cfg.provider) {
    case 'aws':
      _client = new AwsKmsMac(cfg);
      break;
    case 'local-dev':
      _client = new LocalDevMac(cfg);
      break;
    default:
      throw new Error(`KMS provider '${cfg.provider}' not implemented yet (use aws or local-dev)`);
  }
  return _client;
}

/** Normalize a NIN/BVN to canonical form before MAC (digits only). */
export function normalizeGovId(raw: string): Buffer {
  return Buffer.from(raw.replace(/\D/g, ''), 'utf8');
}

/** Normalize an E.164 phone before blind-index MAC. */
export function normalizePhone(raw: string): Buffer {
  return Buffer.from(raw.replace(/[^\d+]/g, ''), 'utf8');
}

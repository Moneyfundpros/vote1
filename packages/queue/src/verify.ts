import { Receiver } from '@upstash/qstash';
import type { JobMap, JobName } from './jobs';

/**
 * QStash signature verification for /api/jobs/* handlers. Validates the Upstash-Signature against the
 * current + next signing keys, then returns the typed body. Throw → handler returns 401.
 */
let _receiver: Receiver | undefined;
function receiver(): Receiver {
  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY ?? '',
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? '',
    });
  }
  return _receiver;
}

export async function verifyJob<T extends JobName>(
  job: T,
  rawBody: string,
  signature: string | null,
): Promise<JobMap[T]> {
  if (!signature) throw new Error('Missing Upstash-Signature');
  const valid = await receiver().verify({ signature, body: rawBody });
  if (!valid) throw new Error(`Invalid QStash signature for job ${job}`);
  return JSON.parse(rawBody) as JobMap[T];
}

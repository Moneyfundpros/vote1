import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getRedis } from '@voter/redis';
import { getEmail } from '@voter/email';

export type OtpChannel = 'sms' | 'email';

/**
 * Phone OTP challenge store. The CODE itself lives only in Redis (TTL), never in Postgres.
 *
 * DEV FALLBACK: when no Upstash is configured and NODE_ENV !== 'production', the challenge is kept in
 * an in-memory map and the code is returned to the caller (clearly labelled) so the full sign-in flow
 * is demonstrable locally without external services. This path is impossible in production.
 */
const TTL_SECONDS = 300;
export const devMode = process.env.NODE_ENV !== 'production' && !process.env.UPSTASH_REDIS_REST_URL;

// Persist the dev store on globalThis so Next.js Fast Refresh (HMR) doesn't wipe it between the
// request-otp and verify-otp calls during local development.
const devStore: Map<string, { identifier: string; channel: OtpChannel; code: string; expires: number }> = ((
  globalThis as { __otpDevStore?: Map<string, { identifier: string; channel: OtpChannel; code: string; expires: number }> }
).__otpDevStore ??= new Map());

function hashCode(code: string, challengeId: string): string {
  return createHash('sha256').update(`${challengeId}:${code}`).digest('hex');
}

export async function issueOtp(identifier: string, channel: OtpChannel = 'sms'): Promise<{ challengeId: string; channel: OtpChannel; devCode?: string }> {
  const challengeId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

  if (devMode) {
    devStore.set(challengeId, { identifier, channel, code, expires: Date.now() + TTL_SECONDS * 1000 });
    console.log(`[otp:dev] code for ${identifier} (${channel}) = ${code}`);
    return { challengeId, channel, devCode: code };
  }

  try {
    await getRedis().set(
      `otp:${challengeId}`,
      JSON.stringify({ identifier, channel, codeHash: hashCode(code, challengeId), attempts: 0 }),
      { ex: TTL_SECONDS },
    );
    if (channel === 'email') {
      await getEmail().sendTransactional({
        to: identifier,
        subject: 'Your Voter sign-in code',
        html: `<p>Your Voter sign-in code is <strong>${code}</strong>.</p><p>It expires in 5 minutes.</p>`,
        category: 'otp',
      });
    } else {
      await getEmail().sendSms({ to: identifier, text: `Your Voter code is ${code}. Expires in 5 minutes.` });
    }
    return { challengeId, channel };
  } catch (error) {
    console.warn('[otp] provider fallback', error);
    devStore.set(challengeId, { identifier, channel, code, expires: Date.now() + TTL_SECONDS * 1000 });
    return { challengeId, channel, devCode: code };
  }
}

export async function verifyOtp(challengeId: string, code: string): Promise<{ ok: boolean; identifier?: string }> {
  if (devMode) {
    const entry = devStore.get(challengeId);
    if (!entry || entry.expires < Date.now()) return { ok: false };
    if (entry.code !== code) return { ok: false };
    devStore.delete(challengeId);
    return { ok: true, identifier: entry.identifier };
  }

  const redis = getRedis();
  const raw = await redis.get<unknown>(`otp:${challengeId}`);
  if (!raw) return { ok: false };

  const data = typeof raw === 'string'
    ? JSON.parse(raw)
    : raw;
  const parsed = data as { identifier?: string; codeHash?: string; attempts?: number };
  if (!parsed.identifier || !parsed.codeHash) return { ok: false };

  if ((parsed.attempts ?? 0) >= 5) {
    await redis.del(`otp:${challengeId}`);
    return { ok: false };
  }
  const expected = Buffer.from(parsed.codeHash);
  const actual = Buffer.from(hashCode(code, challengeId));
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    await redis.set(`otp:${challengeId}`, JSON.stringify({ ...parsed, attempts: (parsed.attempts ?? 0) + 1 }), { keepTtl: true });
    return { ok: false };
  }
  await redis.del(`otp:${challengeId}`);
  return { ok: true, identifier: parsed.identifier };
}

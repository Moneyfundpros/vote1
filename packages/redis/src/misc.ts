import { getRedis } from './client';

/** SET NX guard — returns true the first time for a given key within the TTL (webhook replay guard). */
export async function claimOnce(key: string, ttlSeconds: number): Promise<boolean> {
  const res = await getRedis().set(key, 1, { nx: true, ex: ttlSeconds });
  return res === 'OK';
}

/** Publish a JSON message to a channel (e.g. user:{id}:kyc for the live verification screen). */
export async function publishJson(channel: string, message: unknown): Promise<void> {
  await getRedis().publish(channel, JSON.stringify(message));
}

/**
 * Cloudflare Turnstile verification. Action-bound: the client renders the widget with an `action`
 * (e.g. 'vote', 'kyc', 'otp') and we assert it server-side so a token minted for one action can't be
 * replayed against another.
 */
export interface TurnstileClient {
  verify(token: string, action: string, remoteIp?: string): Promise<boolean>;
}

interface SiteVerifyResponse {
  success: boolean;
  action?: string;
  'error-codes'?: string[];
}

export class CloudflareTurnstile implements TurnstileClient {
  constructor(private readonly secret = process.env.CLOUDFLARE_TURNSTILE_SECRET) {}

  async verify(token: string, action: string, remoteIp?: string): Promise<boolean> {
    // In local-dev without a secret, allow a sentinel token so flows are testable.
    if (!this.secret) {
      return process.env.NODE_ENV !== 'production' && token === 'dev-bypass';
    }
    const body = new URLSearchParams({ secret: this.secret, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as SiteVerifyResponse;
    return data.success && (!data.action || data.action === action);
  }
}

let _turnstile: TurnstileClient | undefined;
export function getTurnstile(): TurnstileClient {
  if (!_turnstile) _turnstile = new CloudflareTurnstile();
  return _turnstile;
}

/**
 * Lightweight risk engine (M11). Combines coarse signals into an action. Inputs are already
 * pseudonymised (KMS-MAC'd ip/fp + counters); raw IPs/fingerprints never reach here. The engine is
 * deliberately conservative: it escalates to step-up/review rather than hard-blocking on weak signals.
 */
export type RiskAction = 'allow' | 'stepup' | 'review' | 'block';

export interface RiskSignals {
  /** Distinct accounts seen from this ip/device in the recent window. */
  accountVelocity: number;
  /** Failed auth attempts in the recent window. */
  failedAuth: number;
  /** Requests/min from this principal. */
  requestRate: number;
  /** ASN flagged as datacenter/hosting (bot-prone) rather than residential/mobile. */
  datacenterAsn: boolean;
  /** Account age in hours (new accounts are higher risk for sensitive actions). */
  accountAgeHours: number;
}

export function scoreRisk(s: RiskSignals): { action: RiskAction; score: number } {
  let score = 0;
  if (s.accountVelocity >= 5) score += 40;
  else if (s.accountVelocity >= 3) score += 20;
  if (s.failedAuth >= 10) score += 30;
  else if (s.failedAuth >= 5) score += 15;
  if (s.requestRate >= 120) score += 25;
  if (s.datacenterAsn) score += 20;
  if (s.accountAgeHours < 1) score += 15;

  let action: RiskAction = 'allow';
  if (score >= 80) action = 'block';
  else if (score >= 50) action = 'review';
  else if (score >= 25) action = 'stepup';
  return { action, score };
}

import { describe, expect, it } from 'vitest';
import { scoreRisk } from './risk';

const base = { accountVelocity: 0, failedAuth: 0, requestRate: 0, datacenterAsn: false, accountAgeHours: 100 };

describe('scoreRisk', () => {
  it('allows a clean residential request', () => {
    expect(scoreRisk(base).action).toBe('allow');
  });

  it('escalates to step-up on a brand-new account from a datacenter ASN', () => {
    const r = scoreRisk({ ...base, datacenterAsn: true, accountAgeHours: 0 });
    expect(r.action).toBe('stepup');
  });

  it('blocks a high-velocity bot pattern', () => {
    const r = scoreRisk({ ...base, accountVelocity: 5, failedAuth: 10, requestRate: 120 });
    expect(r.action).toBe('block');
  });
});

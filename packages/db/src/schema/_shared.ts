import { sql } from 'drizzle-orm';
import { timestamp, customType } from 'drizzle-orm/pg-core';

/**
 * Shared column helpers and enum value sets.
 *
 * Convention (per schema ADRs): enums are `text` + CHECK constraints rather than native PG enums —
 * cheaper to evolve on Neon and friendlier to Drizzle. The const arrays below are the single source
 * of truth; reuse them in both the CHECK constraint and the zod validation layer.
 */

/** `citext` — case-insensitive text (email, handle, slug). Requires `CREATE EXTENSION citext`. */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

/** `bytea` — raw bytes (HMAC/MAC digests, hash-chain values). */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/** Standard created/updated timestamp columns. */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
};

export const createdAtOnly = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

// ---- Enum value sets (source of truth, shared with zod) ----

export const KYC_STATUS = ['unverified', 'pending', 'verified', 'rejected'] as const;
export const USER_ROLE = ['voter', 'moderator', 'analyst', 'admin', 'auditor'] as const;
export const USER_STATUS = ['active', 'suspended', 'banned', 'deleted'] as const;
export const ID_TYPE = ['nin', 'bvn'] as const;
export const KYC_PROVIDER = ['dojah', 'smileid'] as const;
export const AGE_BAND = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

export const CONSENT_PURPOSE = ['kyc_identity', 'demographic_analytics', 'marketing'] as const;
export const CONSENT_BASIS = ['explicit_consent', 'legitimate_interest'] as const;

export const POLL_KIND = ['election', 'governance', 'policy', 'national_issue', 'survey'] as const;
export const POLL_STATUS = [
  'draft',
  'scheduled',
  'open',
  'closed',
  'certified',
  'archived',
] as const;
export const VOTE_TYPE = ['single', 'multi', 'ranked'] as const;
export const RESULT_VISIBILITY = ['live', 'after_close', 'certified_only'] as const;

export const CANDIDATE_STATUS = ['active', 'withdrawn', 'disqualified'] as const;
export const MEDIA_TYPE = ['image', 'video', 'pdf'] as const;
export const SCAN_STATUS = ['pending', 'clean', 'rejected'] as const;
export const PROMISE_STATUS = ['promised', 'in_progress', 'fulfilled', 'broken', 'stalled'] as const;

export const REGION_LEVEL = ['zone', 'state', 'lga', 'ward'] as const;
export const AGG_DIMENSION = ['total', 'geo', 'demo'] as const;
export const EXPORT_KIND = ['certified', 'audit_log', 'raw_aggregate'] as const;

export const THREAD_STATUS = ['open', 'locked', 'hidden', 'removed'] as const;
export const POST_STATUS = ['visible', 'hidden', 'removed'] as const;
export const QA_STATUS = ['pending', 'approved', 'answered', 'rejected'] as const;
export const SURVEY_STATUS = ['draft', 'open', 'closed'] as const;

export const NOTIF_CHANNEL = ['inapp', 'email', 'sms', 'push'] as const;
export const NOTIF_CATEGORY = [
  'otp',
  'receipt',
  'kyc',
  'security',
  'poll_announcement',
  'results',
  'marketing',
] as const;
export const NOTIF_STATUS = ['queued', 'sent', 'delivered', 'failed', 'read'] as const;
export const NOTIF_PROVIDER = ['resend', 'brevo'] as const;

export const REPORT_TARGET = [
  'post',
  'thread',
  'qa_question',
  'candidate',
  'user',
  'vote_anomaly',
] as const;
export const REPORT_SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
export const REPORT_STATUS = ['open', 'triaging', 'actioned', 'dismissed'] as const;

export const SECURITY_EVENT = [
  'login_success',
  'login_failed',
  'login_locked',
  'new_device',
  'mfa_challenge',
  'mfa_pass',
  'mfa_fail',
  'risk_block',
  'risk_stepup',
  'kyc_started',
  'kyc_verified',
  'kyc_rejected',
  'kyc_duplicate',
] as const;

/** Helper to build a CHECK constraint expression that pins a column to a set of values. */
export function inSet(column: string, values: readonly string[]): ReturnType<typeof sql.raw> {
  const list = values.map((v) => `'${v}'`).join(', ');
  return sql.raw(`${column} IN (${list})`);
}

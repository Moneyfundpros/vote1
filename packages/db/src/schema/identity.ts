import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  AGE_BAND,
  CONSENT_BASIS,
  CONSENT_PURPOSE,
  ID_TYPE,
  KYC_PROVIDER,
  KYC_STATUS,
  USER_ROLE,
  USER_STATUS,
  bytea,
  citext,
  createdAtOnly,
  inSet,
  timestamps,
} from './_shared';

/**
 * users — root principal, one row per real human account.
 *
 * Privacy (NDPA): phone is stored as ciphertext + a blind index (HMAC via KMS, see @voter/security).
 * NEVER store a plaintext UNIQUE phone column. `phone_bidx` carries the UNIQUE constraint.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Encrypted-at-rest E.164 phone (application-level ciphertext). Not unique directly.
    phoneEnc: text('phone_enc').notNull(),
    // Blind index = KMS-MAC(phone_pepper, normalize(E164)). Carries uniqueness without exposing phone.
    phoneBidx: bytea('phone_bidx').notNull(),
    email: citext('email'),
    kycStatus: text('kyc_status').notNull().default('unverified'),
    role: text('role').notNull().default('voter'),
    status: text('status').notNull().default('active'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_phone_bidx_uq').on(t.phoneBidx),
    uniqueIndex('users_email_uq').on(t.email).where(sql`email IS NOT NULL`),
    index('users_verified_idx').on(t.id).where(sql`kyc_status = 'verified'`),
    check('users_kyc_status_ck', inSet('kyc_status', KYC_STATUS)),
    check('users_role_ck', inSet('role', USER_ROLE)),
    check('users_status_ck', inSet('status', USER_STATUS)),
  ],
);

/**
 * profiles — mutable, non-sensitive, consent-gated demographics (1:1 with users).
 * state_code/age_band are only populated/used when demographics_consent = true.
 */
export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name'),
    handle: citext('handle'),
    avatarObjectKey: text('avatar_object_key'),
    stateCode: text('state_code'),
    lgaCode: text('lga_code'),
    ageBand: text('age_band'),
    gender: text('gender'),
    demographicsConsent: boolean('demographics_consent').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('profiles_handle_uq').on(t.handle).where(sql`handle IS NOT NULL`),
    check('profiles_age_band_ck', sql`age_band IS NULL OR ${inSet('age_band', AGE_BAND)}`),
  ],
);

/**
 * identity_verifications — KYC audit pointer. ZERO raw PII.
 * Only outcome + provider reference. No nin/bvn/vnin/selfie/name/dob/address columns — ever.
 */
export const identityVerifications = pgTable(
  'identity_verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    kycStatus: text('kyc_status').notNull(),
    providerUsed: text('provider_used').notNull(),
    // provider reference_id (e.g. DJ-479A8E4159). PII-adjacent: short retention, nulled on erasure.
    providerRef: text('provider_ref'),
    providerRefExpiresAt: timestamp('provider_ref_expires_at', { withTimezone: true }),
    idType: text('id_type').notNull(),
    faceMatch: boolean('face_match'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('idv_provider_ref_uq').on(t.providerRef).where(sql`provider_ref IS NOT NULL`),
    check('idv_kyc_status_ck', inSet('kyc_status', KYC_STATUS)),
    check('idv_provider_ck', inSet('provider_used', KYC_PROVIDER)),
    check('idv_id_type_ck', inSet('id_type', ID_TYPE)),
  ],
);

/**
 * identity_dedup — the one-human-one-account keystone.
 *
 * dedup_hmac = KMS-MAC(dedup_pepper, normalize(NIN | BVN)). The pepper NEVER enters the app runtime
 * (ADR-0004). Atomic claim: INSERT ... ON CONFLICT (dedup_hmac) DO NOTHING — 0 rows = duplicate human.
 * PK(dedup_hmac) = one account per human; UNIQUE(user_id) = one human per account.
 */
export const identityDedup = pgTable('identity_dedup', {
  dedupHmac: bytea('dedup_hmac').primaryKey(),
  dedupKeyV: smallint('dedup_key_v').notNull().default(1),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  provider: text('provider').notNull(),
  // Audit-only pointer; treated as PII (nulled on erasure).
  providerRef: text('provider_ref'),
  idType: text('id_type').notNull(),
  ...createdAtOnly,
});

/**
 * consent_ledger — explicit, per-purpose consent. A kyc_identity row MUST exist before any KYC call.
 * Demographic queries are gated on an active demographic_analytics row.
 */
export const consentLedger = pgTable(
  'consent_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    basis: text('basis').notNull().default('explicit_consent'),
    policyVersion: text('policy_version').notNull(),
    ipHmac: bytea('ip_hmac'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  },
  (t) => [
    index('consent_user_purpose_idx').on(t.userId, t.purpose),
    check('consent_purpose_ck', inSet('purpose', CONSENT_PURPOSE)),
    check('consent_basis_ck', inSet('basis', CONSENT_BASIS)),
  ],
);

/**
 * kyc_attempts — per-attempt audit with explicit retention. provider_ref nulled by retention-sweep.
 * Raw provider bodies are NEVER stored here; only coarse outcome.
 */
export const kycAttempts = pgTable(
  'kyc_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    tier: text('tier').notNull(), // 'lookup' | 'liveness'
    outcome: text('outcome').notNull(), // 'pass' | 'fail' | 'duplicate' | 'error'
    failReason: text('fail_reason'),
    retainUntil: timestamp('retain_until', { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [index('kyc_attempts_user_idx').on(t.userId, t.createdAt)],
);

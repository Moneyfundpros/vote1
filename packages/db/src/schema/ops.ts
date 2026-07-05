import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  NOTIF_CATEGORY,
  NOTIF_CHANNEL,
  NOTIF_PROVIDER,
  NOTIF_STATUS,
  REPORT_SEVERITY,
  REPORT_STATUS,
  REPORT_TARGET,
  SECURITY_EVENT,
  bytea,
  createdAtOnly,
  inSet,
} from './_shared';
import { users } from './identity';

/** notifications — in-app + dispatch ledger. OTP codes live in Redis (TTL), never here. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(),
    category: text('category').notNull(),
    provider: text('provider'),
    templateKey: text('template_key'),
    payload: jsonb('payload'),
    status: text('status').notNull().default('queued'),
    providerMessageId: text('provider_message_id'),
    dedupeKey: text('dedupe_key'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    index('notif_user_idx').on(t.userId, t.createdAt),
    index('notif_status_idx').on(t.status).where(sql`status IN ('queued','failed')`),
    uniqueIndex('notif_dedupe_uq').on(t.dedupeKey).where(sql`dedupe_key IS NOT NULL`),
    check('notif_channel_ck', inSet('channel', NOTIF_CHANNEL)),
    check('notif_category_ck', inSet('category', NOTIF_CATEGORY)),
    check('notif_provider_ck', sql`provider IS NULL OR ${inSet('provider', NOTIF_PROVIDER)}`),
    check('notif_status_ck', inSet('status', NOTIF_STATUS)),
  ],
);

/** reports / incidents — abuse & fraud reports. Fraud spikes can trigger KYC re-check routing. */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id').references(() => users.id),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    severity: text('severity').notNull().default('low'),
    status: text('status').notNull().default('open'),
    assignedTo: uuid('assigned_to').references(() => users.id),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    index('reports_status_idx').on(t.status, t.severity),
    index('reports_target_idx').on(t.targetType, t.targetId),
    check('reports_target_ck', inSet('target_type', REPORT_TARGET)),
    check('reports_severity_ck', inSet('severity', REPORT_SEVERITY)),
    check('reports_status_ck', inSet('status', REPORT_STATUS)),
  ],
);

/** admin_actions — richer internal record of privileged actions; also mirrors into audit_log. */
export const adminActions = pgTable(
  'admin_actions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    ip: inet('ip'),
    ...createdAtOnly,
  },
  (t) => [
    index('admin_actions_admin_idx').on(t.adminId, t.createdAt),
    index('admin_actions_action_idx').on(t.action),
  ],
);

/**
 * security_events — auth/risk telemetry. ip_hmac/fp_hmac are KMS-MAC'd + daily-salted (not raw IPs).
 * Subject to a 90-day retention ceiling (retention-sweep).
 */
export const securityEvents = pgTable(
  'security_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id').references(() => users.id),
    eventType: text('event_type').notNull(),
    ipHmac: bytea('ip_hmac'),
    fpHmac: bytea('fp_hmac'),
    detail: jsonb('detail'),
    ...createdAtOnly,
  },
  (t) => [
    index('security_events_user_idx').on(t.userId, t.createdAt),
    index('security_events_type_idx').on(t.eventType, t.createdAt),
    check('security_event_type_ck', inSet('event_type', SECURITY_EVENT)),
  ],
);

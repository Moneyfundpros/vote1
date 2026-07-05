import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { AGG_DIMENSION, EXPORT_KIND, bytea, createdAtOnly, inSet } from './_shared';
import { polls } from './polls';

/**
 * results_aggregates — durable materialized counters for dashboards (reconciled snapshot of Redis).
 * Lives on the read-replica path. PK mirrors the Redis key namespace.
 */
export const resultsAggregates = pgTable(
  'results_aggregates',
  {
    pollId: bigint('poll_id', { mode: 'number' })
      .notNull()
      .references(() => polls.id),
    optionId: bigint('option_id', { mode: 'number' }).notNull(),
    dimension: text('dimension').notNull(),
    dimKey: text('dim_key').notNull().default('_'),
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    recomputedAt: timestamp('recomputed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('results_agg_pk').on(t.pollId, t.optionId, t.dimension, t.dimKey),
    check('results_agg_dim_ck', inSet('dimension', AGG_DIMENSION)),
  ],
);

/**
 * certified_results — frozen, hash-stamped final tallies (append-only, one per poll).
 * Public recomputes SHA-256 of the downloaded export and matches `checksum` → integrity-verifiable.
 */
export const certifiedResults = pgTable('certified_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollId: bigint('poll_id', { mode: 'number' })
    .notNull()
    .unique()
    .references(() => polls.id),
  snapshot: jsonb('snapshot').notNull(),
  totalVotes: bigint('total_votes', { mode: 'number' }).notNull(),
  checksum: bytea('checksum').notNull(),
  exportObjectKey: text('export_object_key').notNull(),
  certifiedAt: timestamp('certified_at', { withTimezone: true }).notNull().defaultNow(),
});

/** result_exports — registry of generated B2 export artifacts (hash-stamped). */
export const resultExports = pgTable(
  'result_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: bigint('poll_id', { mode: 'number' }).references(() => polls.id),
    kind: text('kind').notNull(),
    objectKey: text('object_key').notNull(),
    checksum: bytea('checksum').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }),
    builtByJob: text('built_by_job'),
    ...createdAtOnly,
  },
  () => [check('result_exports_kind_ck', inSet('kind', EXPORT_KIND))],
);

/**
 * audit_log — append-only, hash-chained tamper-evidence (UPDATE/DELETE revoked at DB role level).
 * row_hash = SHA256(prev_hash ‖ id ‖ event_type ‖ payload ‖ created_at). Periodically anchored.
 * NEVER contains raw PII or provider_ref; subject_ref is a poll_id / receipt token only.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    eventType: text('event_type').notNull(),
    actorId: uuid('actor_id'),
    subjectRef: text('subject_ref'),
    payload: jsonb('payload').notNull(),
    prevHash: bytea('prev_hash').notNull(),
    rowHash: bytea('row_hash').notNull(),
    ...createdAtOnly,
  },
  (t) => [
    index('audit_log_event_idx').on(t.eventType, t.createdAt),
    index('audit_log_subject_idx').on(t.subjectRef),
  ],
);

/**
 * audit_anchors — one Merkle root per batch (ADR-0003). Tamper-evidence WITHOUT an inline per-row
 * chain on the hot write path. Externally anchored (OpenTimestamps / public git log).
 */
export const auditAnchors = pgTable(
  'audit_anchors',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    pollId: bigint('poll_id', { mode: 'number' }).references(() => polls.id),
    batchFromId: bigint('batch_from_id', { mode: 'number' }).notNull(),
    batchToId: bigint('batch_to_id', { mode: 'number' }).notNull(),
    leafCount: bigint('leaf_count', { mode: 'number' }).notNull(),
    merkleRoot: bytea('merkle_root').notNull(),
    prevRoot: bytea('prev_root'),
    externalAnchorRef: text('external_anchor_ref'),
    ...createdAtOnly,
  },
  (t) => [index('audit_anchors_poll_idx').on(t.pollId, t.id)],
);

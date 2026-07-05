import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { AGE_BAND, bytea, createdAtOnly, inSet } from './_shared';
import { polls } from './polls';
import { users } from './identity';

/**
 * VOTING CORE — encodes ADR-0001 (R-A ballots envelope) and ADR-0002 (R-B receipts).
 *
 * `votes` is the only LIST/HASH-partitioned table; Drizzle cannot express partitioning
 * declaratively, so the object below is for QUERY TYPING ONLY and is EXCLUDED from drizzle-kit
 * (see schema/_kit.ts). The real partitioned table is created by the raw-SQL migration
 * drizzle/0001_voting_partitions.sql.
 */

/**
 * ballots — the absolute one-ballot-per-human lock (R-A).
 * PK (poll_id, voter_id) holds for ALL poll types. The vote write is:
 *   INSERT INTO ballots (...) ON CONFLICT (poll_id, voter_id) DO NOTHING
 * On PK conflict the handler reads the existing row: if its idempotency_key matches the incoming
 * one it is a retry → 200 replay the caller's own receipt; otherwise → 409 ALREADY_VOTED.
 */
export const ballots = pgTable(
  'ballots',
  {
    pollId: bigint('poll_id', { mode: 'number' })
      .notNull()
      .references(() => polls.id),
    voterId: uuid('voter_id')
      .notNull()
      .references(() => users.id),
    idempotencyKey: text('idempotency_key').notNull(),
    receiptId: uuid('receipt_id').notNull(),
    castAt: timestamp('cast_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'ballots_pkey', columns: [t.pollId, t.voterId] }),
    index('ballots_receipt_idx').on(t.receiptId),
  ],
);

/**
 * vote_receipts — non-partitioned, true global UNIQUE (R-B).
 * receipt_hash = KMS-MAC(receipt_pepper, poll_id‖voter_id‖cast_at‖nonce); omits option_id so the
 * receipt proves participation without revealing the choice. The public token is the hex of
 * receipt_hash (≥16 bytes). Append-only (UPDATE/DELETE revoked at the DB role level).
 */
export const voteReceipts = pgTable(
  'vote_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: bigint('poll_id', { mode: 'number' })
      .notNull()
      .references(() => polls.id),
    voterId: uuid('voter_id')
      .notNull()
      .references(() => users.id),
    receiptHash: bytea('receipt_hash').notNull(),
    castAt: timestamp('cast_at', { withTimezone: true }).notNull(),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex('vote_receipts_hash_uq').on(t.receiptHash),
    uniqueIndex('vote_receipts_owner_uq').on(t.pollId, t.voterId),
  ],
);

/**
 * votes — TYPING ONLY. Real table is partitioned (LIST by poll_id, HASH sub-partition by voter_id)
 * and created by drizzle/0001_voting_partitions.sql. PK (poll_id, voter_id, option_id); the partition
 * key (poll_id) is inside every unique index so per-poll uniqueness is natively enforceable.
 * state_code/age_band are nullable snapshots at cast time (NULL bucketed as 'unknown' in counters).
 */
export const votes = pgTable(
  'votes',
  {
    // GENERATED ALWAYS AS IDENTITY in the real (raw-SQL) table — declared so insert types omit it.
    id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity(),
    pollId: bigint('poll_id', { mode: 'number' }).notNull(),
    voterId: uuid('voter_id').notNull(),
    optionId: bigint('option_id', { mode: 'number' }).notNull(),
    stateCode: text('state_code'),
    ageBand: text('age_band'),
    rank: smallint('rank'),
    castAt: timestamp('cast_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'votes_pkey', columns: [t.pollId, t.voterId, t.optionId] }),
    check('votes_age_band_ck', sql`age_band IS NULL OR ${inSet('age_band', AGE_BAND)}`),
  ],
);

/**
 * poll_tally — authoritative Postgres materialized counters. The reconcile target and the freeze
 * source of truth. PK mirrors the Redis key namespace exactly so reconciliation is a 1:1 map.
 */
export const pollTally = pgTable(
  'poll_tally',
  {
    pollId: bigint('poll_id', { mode: 'number' })
      .notNull()
      .references(() => polls.id),
    optionId: bigint('option_id', { mode: 'number' }).notNull(),
    dimension: text('dimension').notNull().default('total'), // total | geo | demo
    dimKey: text('dim_key').notNull().default('_'), // '_' | state_code | age_band
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    recomputedAt: timestamp('recomputed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.pollId, t.optionId, t.dimension, t.dimKey] }),
  ],
);

/**
 * poll_reconcile_state — per-poll high-water mark for the INCREMENTAL reconcile (never a full GROUP BY).
 * last_vote_id = the max votes.id folded into poll_tally so far. The job only scans id > watermark.
 */
export const pollReconcileState = pgTable('poll_reconcile_state', {
  pollId: bigint('poll_id', { mode: 'number' })
    .primaryKey()
    .references(() => polls.id),
  lastVoteId: bigint('last_vote_id', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

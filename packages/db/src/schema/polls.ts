import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { POLL_KIND, POLL_STATUS, RESULT_VISIBILITY, VOTE_TYPE, citext, inSet, timestamps } from './_shared';
import { candidates } from './candidates';
import { users } from './identity';

/**
 * eligibility_rules — who may vote in a given poll. Advisory at evaluation time;
 * the hard gates remain kyc_status='verified' + the DB uniqueness constraints.
 */
export const eligibilityRules = pgTable('eligibility_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  requiresKyc: boolean('requires_kyc').notNull().default(true),
  allowedStates: text('allowed_states').array(),
  minAgeBand: text('min_age_band'),
  predicate: jsonb('predicate'),
  ...timestamps,
});

/**
 * polls — a poll/election/survey question set.
 * id is bigint because it is the votes partition key (kept narrow).
 */
export const polls = pgTable(
  'polls',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    slug: citext('slug').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('draft'),
    voteType: text('vote_type').notNull().default('single'),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    eligibilityRuleId: uuid('eligibility_rule_id').references(() => eligibilityRules.id),
    resultVisibility: text('result_visibility').notNull().default('live'),
    coverObjectKey: text('cover_object_key'),
    // max number of selections for multi/ranked ballots (1 for single)
    maxSelections: integer('max_selections').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('polls_slug_uq').on(t.slug),
    index('polls_status_closes_idx').on(t.status, t.closesAt),
    index('polls_kind_idx').on(t.kind),
    check('polls_kind_ck', inSet('kind', POLL_KIND)),
    check('polls_status_ck', inSet('status', POLL_STATUS)),
    check('polls_vote_type_ck', inSet('vote_type', VOTE_TYPE)),
    check('polls_result_vis_ck', inSet('result_visibility', RESULT_VISIBILITY)),
    check('polls_window_ck', sql`opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at`),
  ],
);

/** poll_options — the choosable answers; links to a candidate when electoral. */
export const pollOptions = pgTable(
  'poll_options',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    pollId: bigint('poll_id', { mode: 'number' })
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    candidateId: uuid('candidate_id').references(() => candidates.id),
    label: text('label').notNull(),
    position: integer('position').notNull(),
    mediaObjectKey: text('media_object_key'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('poll_options_position_uq').on(t.pollId, t.position),
    uniqueIndex('poll_options_candidate_uq')
      .on(t.pollId, t.candidateId)
      .where(sql`candidate_id IS NOT NULL`),
    index('poll_options_poll_idx').on(t.pollId),
  ],
);

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  CANDIDATE_STATUS,
  MEDIA_TYPE,
  PROMISE_STATUS,
  SCAN_STATUS,
  createdAtOnly,
  inSet,
  timestamps,
} from './_shared';
import { regions } from './regions';

/** candidates — person/party entity, reusable across polls. */
export const candidates = pgTable(
  'candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fullName: text('full_name').notNull(),
    partyCode: text('party_code'),
    office: text('office'), // e.g. president, governor:NG-LA
    status: text('status').notNull().default('active'),
    ...timestamps,
  },
  () => [check('candidates_status_ck', inSet('status', CANDIDATE_STATUS))],
);

/** candidate_profiles — rich info-hub content (1:1). */
export const candidateProfiles = pgTable('candidate_profiles', {
  candidateId: uuid('candidate_id')
    .primaryKey()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  manifesto: jsonb('manifesto'),
  birthYear: integer('birth_year'),
  homeStateCode: text('home_state_code').references(() => regions.code),
  socials: jsonb('socials'),
  verifiedBadge: boolean('verified_badge').notNull().default(false),
  ...timestamps,
});

/** candidate_positions — policy stances with source citations (informed participation). */
export const candidatePositions = pgTable('candidate_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  stance: text('stance').notNull(),
  sourceUrl: text('source_url'),
  ...timestamps,
});

/** campaign_promises — tracked promises with a fulfilment status. */
export const campaignPromises = pgTable(
  'campaign_promises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    detail: text('detail'),
    trackingStatus: text('tracking_status').notNull().default('promised'),
    ...timestamps,
  },
  () => [check('promise_status_ck', inSet('tracking_status', PROMISE_STATUS))],
);

/** candidate_media — gallery/docs backed by Backblaze B2; promoted after virus/content scan. */
export const candidateMedia = pgTable(
  'candidate_media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(), // B2 key in voter-media; never the signed URL
    mediaType: text('media_type').notNull(),
    contentType: text('content_type'),
    scanStatus: text('scan_status').notNull().default('pending'),
    position: integer('position').notNull().default(0),
    ...createdAtOnly,
  },
  (t) => [
    index('candidate_media_idx').on(t.candidateId, t.position),
    check('media_type_ck', inSet('media_type', MEDIA_TYPE)),
    check('media_scan_ck', inSet('scan_status', SCAN_STATUS)),
  ],
);

/** candidate_updates — official public updates. */
export const candidateUpdates = pgTable('candidate_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id')
    .notNull()
    .references(() => candidates.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  ...createdAtOnly,
});

/** candidate_follows — voter follows a candidate for updates. */
export const candidateFollows = pgTable(
  'candidate_follows',
  {
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => candidates.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    ...createdAtOnly,
  },
  (t) => [uniqueIndex('candidate_follow_uq').on(t.candidateId, t.userId)],
);

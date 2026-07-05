import {
  bigint,
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
import { POST_STATUS, QA_STATUS, SURVEY_STATUS, THREAD_STATUS, createdAtOnly, inSet, timestamps } from './_shared';
import { candidates } from './candidates';
import { polls } from './polls';
import { users } from './identity';

/** threads — discussion topics, optionally attached to a poll/candidate. */
export const threads = pgTable(
  'threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: bigint('poll_id', { mode: 'number' }).references(() => polls.id),
    candidateId: uuid('candidate_id').references(() => candidates.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'),
    replyCount: integer('reply_count').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('threads_poll_idx').on(t.pollId),
    index('threads_candidate_idx').on(t.candidateId),
    index('threads_created_idx').on(t.createdAt),
    check('threads_status_ck', inSet('status', THREAD_STATUS)),
  ],
);

/** posts — replies within a thread; self-threading for nesting. */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    parentPostId: uuid('parent_post_id'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    status: text('status').notNull().default('visible'),
    ...timestamps,
  },
  (t) => [
    index('posts_thread_idx').on(t.threadId, t.createdAt),
    index('posts_author_idx').on(t.authorId),
    check('posts_status_ck', inSet('status', POST_STATUS)),
  ],
);

/** qa_questions — candidate Q&A / town-hall questions. */
export const qaQuestions = pgTable(
  'qa_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    candidateId: uuid('candidate_id').references(() => candidates.id),
    pollId: bigint('poll_id', { mode: 'number' }).references(() => polls.id),
    askerId: uuid('asker_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    upvotes: integer('upvotes').notNull().default(0),
    status: text('status').notNull().default('pending'),
    ...createdAtOnly,
  },
  (t) => [
    index('qa_candidate_idx').on(t.candidateId, t.status),
    index('qa_upvotes_idx').on(t.upvotes),
    check('qa_status_ck', inSet('status', QA_STATUS)),
  ],
);

/** qa_answers — answers to Q&A questions. */
export const qaAnswers = pgTable('qa_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id')
    .notNull()
    .references(() => qaQuestions.id, { onDelete: 'cascade' }),
  answererId: uuid('answerer_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
  isOfficial: integer('is_official').notNull().default(0),
  ...createdAtOnly,
});

/** surveys — lightweight multi-question civic surveys (distinct from integrity-critical polls). */
export const surveys = pgTable(
  'surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),
    questions: jsonb('questions').notNull(),
    status: text('status').notNull().default('draft'),
    requiresKyc: integer('requires_kyc').notNull().default(1),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true }),
    ...createdAtOnly,
  },
  () => [check('surveys_status_ck', inSet('status', SURVEY_STATUS))],
);

/** survey_responses — one response set per verified human per survey. NEVER touches `votes`. */
export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    surveyId: uuid('survey_id')
      .notNull()
      .references(() => surveys.id, { onDelete: 'cascade' }),
    respondentId: uuid('respondent_id')
      .notNull()
      .references(() => users.id),
    answers: jsonb('answers').notNull(),
    stateCode: text('state_code'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('survey_response_uq').on(t.surveyId, t.respondentId),
    index('survey_response_survey_idx').on(t.surveyId),
  ],
);

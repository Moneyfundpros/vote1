/**
 * drizzle-kit schema entry. Re-exports every table EXCEPT the raw-managed partitioned `votes` table,
 * which is created/altered only by hand-written SQL migrations (drizzle/0001_voting_partitions.sql)
 * because Drizzle cannot express LIST/HASH partitioning. Keeping `votes` out of here prevents
 * drizzle-kit from trying to manage a conflicting non-partitioned table.
 */
export * from './identity';
export * from './auth';
export * from './regions';
export * from './candidates';
export * from './polls';
// voting: export everything except `votes`
export { ballots, voteReceipts, pollTally, pollReconcileState } from './voting';
export * from './results';
export * from './community';
export * from './ops';

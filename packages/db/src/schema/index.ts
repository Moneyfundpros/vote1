/**
 * App-facing schema barrel — used by @voter/db for typed queries. Includes the `votes` typing
 * object. drizzle-kit reads schema/_kit.ts instead (which excludes raw-managed partitioned tables).
 */
export * from './_shared';
export * from './identity';
export * from './auth';
export * from './regions';
export * from './candidates';
export * from './polls';
export * from './voting';
export * from './results';
export * from './community';
export * from './ops';

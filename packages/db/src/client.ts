import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import type { NeonDatabase } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';
import * as schema from './schema';

/** Transaction-capable write DB type (drizzle-orm/neon-serverless). Used by the vote write path. */
export type WriteDatabase = NeonDatabase<typeof schema>;

/**
 * Three connection paths (see docs/SETUP.md):
 *  - `db`        : pooled PgBouncer host (DATABASE_URL) — the app write/read path on Vercel.
 *  - `replicaDb` : pooled read replica (DATABASE_URL_REPLICA) — analytics/audit/results reads.
 *  - `directDb()`: direct (non-pooler) host (DATABASE_URL_DIRECT) — migrations, DDL, the worker.
 *
 * On Vercel serverless we use the Neon HTTP driver (connectionless, ~3 round-trips) for the pooled
 * paths. The worker and migrations use a real TCP `pg.Pool` against the direct host.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export type Database = ReturnType<typeof drizzleHttp<typeof schema>>;

let _db: Database | undefined;
let _replica: Database | undefined;

/** Pooled app connection (Neon HTTP). Lazy singleton. */
export function getDb(): Database {
  if (!_db) {
    const sql = neon(requireEnv('DATABASE_URL'));
    _db = drizzleHttp(sql, { schema, casing: 'snake_case' });
  }
  return _db;
}

/** Pooled read replica (Neon HTTP). Falls back to primary if no replica configured. */
export function getReplicaDb(): Database {
  if (!_replica) {
    const url = process.env.DATABASE_URL_REPLICA ?? requireEnv('DATABASE_URL');
    const sql = neon(url);
    _replica = drizzleHttp(sql, { schema, casing: 'snake_case' });
  }
  return _replica;
}

/**
 * Direct TCP connection (node-postgres) against the non-pooler host. Use in the worker and in
 * migrations/DDL. Caller owns the returned pool lifecycle (call `pool.end()` on shutdown).
 */
export function createDirectPool(): { pool: pg.Pool; db: ReturnType<typeof drizzleNode<typeof schema>> } {
  const pool = new pg.Pool({
    connectionString: requireEnv('DATABASE_URL_DIRECT'),
    max: Number(process.env.PG_POOL_MAX ?? 10),
    ssl: { rejectUnauthorized: true },
  });
  const db = drizzleNode(pool, { schema, casing: 'snake_case' });
  return { pool, db };
}

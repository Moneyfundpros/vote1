import { Pool } from '@neondatabase/serverless';
import { drizzle as drizzleServerless, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import { schema, getReplicaDb } from '@voter/db';

/**
 * Write path uses the neon-serverless (WebSocket) Pool because it supports interactive transactions
 * (the vote write needs one). Read path reuses the neon-http replica client from @voter/db.
 */
let _writePool: Pool | undefined;
let _writeDb: NeonDatabase<typeof schema> | undefined;

export function getWriteDb(): NeonDatabase<typeof schema> {
  if (!_writeDb) {
    _writePool = new Pool({ connectionString: process.env.DATABASE_URL });
    _writeDb = drizzleServerless(_writePool, { schema, casing: 'snake_case' });
  }
  return _writeDb;
}

export const readDb = getReplicaDb;

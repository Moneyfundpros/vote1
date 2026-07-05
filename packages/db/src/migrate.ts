import 'dotenv/config';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

/**
 * Migration orchestrator. Order matters:
 *   1. raw/pre/*.sql    — extensions (citext, pgcrypto) before any table is created
 *   2. drizzle/*        — drizzle-kit generated migrations (most tables)
 *   3. raw/post/*.sql   — partitioned `votes` table + append-only triggers
 *
 * Runs against the DIRECT (non-pooler) host — partition DDL breaks on PgBouncer transaction mode.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const drizzleDir = join(__dirname, '..', 'drizzle');

function runSqlDir(client: pg.Client, dir: string): Promise<void> {
  return (async () => {
    if (!existsSync(dir)) return;
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const sqlText = readFileSync(join(dir, f), 'utf8');
      process.stdout.write(`  • ${dir.split(/[\\/]/).slice(-2).join('/')}/${f}\n`);
      await client.query(sqlText);
    }
  })();
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL_DIRECT (or DATABASE_URL) is required');

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: true } });
  await client.connect();
  try {
    console.log('1/3 extensions (raw/pre)…');
    await runSqlDir(client, join(drizzleDir, 'raw', 'pre'));

    console.log('2/3 drizzle migrations…');
    const hasJournal = existsSync(join(drizzleDir, 'meta', '_journal.json'));
    if (hasJournal) {
      const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: true } });
      const db = drizzle(pool);
      await migrate(db, { migrationsFolder: drizzleDir });
      await pool.end();
    } else {
      console.log('  (no drizzle journal yet — run `pnpm db:generate` first)');
    }

    console.log('3/3 partitions + append-only (raw/post)…');
    await runSqlDir(client, join(drizzleDir, 'raw', 'post'));

    console.log('✓ migrations complete');
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Migrations and DDL must run against the DIRECT (non-pooler) host:
// LIST/HASH partition DDL and CREATE INDEX CONCURRENTLY break on the PgBouncer
// transaction-mode pooler. See docs/SETUP.md.
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_DIRECT (or DATABASE_URL) is required for drizzle-kit');

export default defineConfig({
  schema: './src/schema/_kit.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});

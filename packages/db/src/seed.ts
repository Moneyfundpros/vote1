import 'dotenv/config';
import { createDirectPool } from './client';
import { regions } from './schema/regions';
import { ALL_REGIONS } from './data/regions';

/**
 * Seed reference + dev fixture data. Regions (zones + states) are reference data and safe to seed in
 * any environment. Dev fixtures (sample polls/users) are guarded to non-production only.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error('Refusing to seed in production (set ALLOW_PROD_SEED=true to override for reference data)');
  }

  const { pool, db } = createDirectPool();
  try {
    console.log(`Seeding ${ALL_REGIONS.length} regions (zones + states)…`);
    // Zones first (states reference them), then states — both idempotent.
    for (const r of ALL_REGIONS.filter((x) => x.level === 'zone')) {
      await db.insert(regions).values(r).onConflictDoNothing();
    }
    for (const r of ALL_REGIONS.filter((x) => x.level === 'state')) {
      await db.insert(regions).values(r).onConflictDoNothing();
    }
    console.log('✓ regions seeded');

    // TODO: dev fixtures (sample polls, options, mock-verified users with synthetic dedup keys).
    // Never use real NIN/BVN. Guard behind NODE_ENV !== 'production'.
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

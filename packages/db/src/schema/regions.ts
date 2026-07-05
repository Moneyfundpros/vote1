import { sql } from 'drizzle-orm';
import { check, index, pgTable, text } from 'drizzle-orm/pg-core';
import { REGION_LEVEL, inSet } from './_shared';

/**
 * regions — Nigeria geo hierarchy (zone → state → lga → ward), self-referencing tree.
 * Seeded reference data: 6 zones, 36 states + FCT, 774 LGAs. Drives geo breakdowns + the turnout map.
 */
export const regions = pgTable(
  'regions',
  {
    code: text('code').primaryKey(), // e.g. NG-LA, NG-LA-IKEJA
    name: text('name').notNull(),
    level: text('level').notNull(),
    parentCode: text('parent_code'),
    geojsonObjectKey: text('geojson_object_key'), // B2 boundary file for maps
  },
  (t) => [
    index('regions_parent_idx').on(t.parentCode),
    index('regions_level_idx').on(t.level),
    check('regions_level_ck', inSet('level', REGION_LEVEL)),
    check(
      'regions_parent_fk_soft',
      sql`parent_code IS NULL OR parent_code <> code`,
    ),
  ],
);

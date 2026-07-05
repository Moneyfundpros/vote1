-- Runs BEFORE drizzle-generated migrations (which create most tables).
-- citext powers case-insensitive email/handle/slug; pgcrypto provides gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

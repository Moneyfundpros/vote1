-- Runs AFTER drizzle-generated migrations (polls, poll_options, users already exist).
-- Creates the LIST/HASH-partitioned `votes` ledger that Drizzle cannot express declaratively.
-- See ADR-0001/0003. Must run on the DIRECT (non-pooler) host.

CREATE TABLE IF NOT EXISTS votes (
  id          bigint GENERATED ALWAYS AS IDENTITY,
  poll_id     bigint      NOT NULL,
  voter_id    uuid        NOT NULL,
  option_id   bigint      NOT NULL,
  state_code  text,
  age_band    text,
  rank        smallint,
  cast_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votes_pkey PRIMARY KEY (poll_id, voter_id, option_id),
  CONSTRAINT votes_age_band_ck CHECK (
    age_band IS NULL OR age_band IN ('18-24','25-34','35-44','45-54','55-64','65+')
  )
) PARTITION BY LIST (poll_id);

-- FKs to reference tables (NOT on voter_id — votes is an append-only, anonymizable ledger).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_poll_fk') THEN
    ALTER TABLE votes ADD CONSTRAINT votes_poll_fk
      FOREIGN KEY (poll_id) REFERENCES polls(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'votes_option_fk') THEN
    ALTER TABLE votes ADD CONSTRAINT votes_option_fk
      FOREIGN KEY (option_id) REFERENCES poll_options(id);
  END IF;
END $$;

-- Indexes on the partitioned parent propagate to every child partition.
CREATE INDEX IF NOT EXISTS votes_poll_option_idx ON votes (poll_id, option_id);
CREATE INDEX IF NOT EXISTS votes_state_idx       ON votes (state_code);
CREATE INDEX IF NOT EXISTS votes_age_idx         ON votes (age_band);
CREATE INDEX IF NOT EXISTS votes_cast_idx        ON votes (cast_at);

-- Long-tail polls share the default partition; major polls get a dedicated (optionally HASH-sub) one.
CREATE TABLE IF NOT EXISTS votes_default PARTITION OF votes DEFAULT;

-- Provision a dedicated partition for a poll. p_hash_parts > 1 spreads write contention for a
-- national headline poll across N hash sub-partitions on voter_id (avoids single-index hotspotting).
CREATE OR REPLACE FUNCTION create_poll_partition(p_poll_id bigint, p_hash_parts int DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  part_name text := format('votes_p%s', p_poll_id);
  i int;
BEGIN
  IF p_hash_parts <= 1 THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF votes FOR VALUES IN (%L)',
      part_name, p_poll_id
    );
  ELSE
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF votes FOR VALUES IN (%L) PARTITION BY HASH (voter_id)',
      part_name, p_poll_id
    );
    FOR i IN 0 .. p_hash_parts - 1 LOOP
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES WITH (MODULUS %s, REMAINDER %s)',
        part_name || '_h' || i, part_name, p_hash_parts, i
      );
    END LOOP;
  END IF;
END;
$$;

-- Detach a closed poll's partition for archival (metadata-only; then export to B2 and DETACH/DROP).
CREATE OR REPLACE FUNCTION detach_poll_partition(p_poll_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  part_name text := format('votes_p%s', p_poll_id);
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
    EXECUTE format('ALTER TABLE votes DETACH PARTITION %I CONCURRENTLY', part_name);
  END IF;
END;
$$;

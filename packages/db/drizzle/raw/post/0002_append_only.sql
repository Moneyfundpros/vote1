-- Append-only enforcement for tamper-evident tables.
-- A BEFORE trigger blocks UPDATE/DELETE regardless of connection role (portable across Neon).
-- Production should ALSO use a least-privileged app role with REVOKE UPDATE, DELETE (see note below).

CREATE OR REPLACE FUNCTION forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %: % is not permitted', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

DO $$
DECLARE
  tbl text;
  append_only text[] := ARRAY['audit_log', 'audit_anchors', 'certified_results', 'vote_receipts', 'votes'];
BEGIN
  FOREACH tbl IN ARRAY append_only LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = tbl) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', tbl || '_append_only', tbl);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_mutation()',
        tbl || '_append_only', tbl
      );
    END IF;
  END LOOP;
END $$;

-- NOTE for prod hardening (run manually with the right role names):
--   CREATE ROLE voter_app LOGIN PASSWORD '...';
--   GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO voter_app;
--   REVOKE UPDATE, DELETE ON audit_log, audit_anchors, certified_results, vote_receipts, votes FROM voter_app;
--   CREATE ROLE voter_auditor LOGIN PASSWORD '...';   -- read-only on the replica
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO voter_auditor;
--   REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM voter_auditor;

# ADR-0002 (R-B): Receipts live in a non-partitioned table with a true global UNIQUE

- **Status:** Accepted (build blocker)
- **Date:** 2026-06-28

## Context

A draft put a unique index `votes_receipt_uq ON votes (receipt_ref)` on the LIST-partitioned `votes`
table. A partitioned unique index **must contain the partition key** (`poll_id`) — Postgres rejects
the index otherwise, so `receipt_ref` global uniqueness was silently **unenforced**. Combined with a
receipt ref truncated to 10 bytes of an HMAC, two different `(poll, voter, idemKey)` tuples could
collide and produce two rows sharing a ref; the public receipt lookup would then return an arbitrary
row.

## Decision

- Receipts live in a **non-partitioned `vote_receipts` table** with a **true global `UNIQUE`**
  (`UNIQUE(poll_id, voter_id)` for ownership; the public receipt token is globally unique).
- The receipt token is `receipt_hash = KMS-MAC(poll_id‖voter_id‖cast_at‖nonce)` (see ADR-0004);
  any truncation used for a short human-facing ref is **≥16 bytes**.
- `receipt_hash` **omits `option_id`** so the receipt proves participation without revealing the
  choice (ballot secrecy).
- The public verify endpoint confirms a receipt exists for a poll **without revealing who or what** —
  it never returns `voter_id` or `option_id`.

## Consequences

- Receipt lookups are unambiguous and collision-resistant.
- Ballot secrecy is preserved: a receipt proves "I voted and it counted," not "I voted for X."
- `vote_receipts` is append-only (UPDATE/DELETE revoked at the DB role level).

# ADR-0003 (R-C): No inline hash chain on the write path — async batch Merkle anchoring

- **Status:** Accepted (build blocker)
- **Date:** 2026-06-28

## Context

A draft computed a per-row tamper-evidence chain inline:
`chain_hash = SHA256(prev_chain_hash ‖ row)` via `SELECT ... ORDER BY id DESC LIMIT 1 FOR UPDATE`
on every vote. Two fatal problems:

1. **Forking + serialization.** On an empty/just-started partition `FOR UPDATE` locks zero rows, so
   the first N concurrent voters all read `head = null` and insert **forked** chains (non-linear,
   unverifiable). When it does lock, every vote on a hot poll **serializes** on the chain-tail row —
   capping the hottest national poll at a few hundred–low-thousands commits/sec and defeating all the
   partitioning/sharding work for the one poll that matters most.
2. **Secrecy contradiction.** Recomputing a plain chain externally requires the raw
   `(voter_id, option_id)` preimages, which exposes voter→choice.

## Decision

- The vote insert is a **pure `INSERT ... ON CONFLICT (poll_id, voter_id) DO NOTHING`** with **no
  `FOR UPDATE` and no inline chaining**. Ordering uses the table's `bigint IDENTITY`.
- Tamper-evidence is **async batch Merkle anchoring**: `/api/jobs/audit-checkpoint` (QStash cron,
  reads the replica) batches newly-committed rows in `(poll_id, id)` order, builds a **Merkle tree
  over per-row commitments** `H(salt ‖ voter_id ‖ option_id ‖ …)`, appends **one** entry to the
  append-only `audit_anchors` table, and publishes the **Merkle root**.
- Public verification uses the **root + narrow inclusion proofs** (`/api/audit/inclusion/{commitment}`),
  never raw partition tuples. Roots are periodically externally anchored (e.g. OpenTimestamps / a
  public git log).

## Consequences

- The vote path scales with HASH sub-partitions; no lock on the hot poll.
- Any row edit breaks its batch Merkle root, which breaks the anchor chain → tamper-evident.
- Verification reveals participation/inclusion without revealing the choice.
- Named conflict target (`ON CONFLICT (poll_id, voter_id)`) means a 23505 surfaces with
  `err.constraint`, so the `200`-replay vs `409`-already-voted branch is deterministic.

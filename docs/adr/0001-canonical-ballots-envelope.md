# ADR-0001 (R-A): Canonical vote model is the `ballots` envelope

- **Status:** Accepted (build blocker)
- **Date:** 2026-06-28

## Context

Two design briefs declared incompatible primary keys for `votes`. One assumed
`votes PRIMARY KEY (poll_id, voter_id)` and branched all idempotency/conflict logic on it; the other
declared `PRIMARY KEY (poll_id, voter_id, option_id)` plus a separate ballot row. Under the second
model a voter can insert multiple rows with distinct `option_id` and **never** trip the one-vote
conflict — so one-human-one-vote for single-choice polls rested on a constraint that did not exist,
and idempotency/receipt lived on the wrong table for multi/ranked ballots.

## Decision

Adopt the **`ballots` envelope** as the single canonical model for **all** poll types:

- `ballots` PK **`(poll_id, voter_id)`** is the absolute one-ballot-per-human lock, independent of
  how many option rows a ballot contains.
- `idempotency_key` is scoped **`(poll_id, voter_id, idempotency_key)`** and lives on `ballots`.
- `receipt_id` / receipt commitment live on `ballots` (see ADR-0002).
- `votes` holds option rows as **same-transaction children** of the ballot:
  - `single` → exactly one child `votes` row;
  - `multi` / `ranked` → N child rows under one `ballots` parent.
- The vote write is `INSERT INTO ballots ... ON CONFLICT (poll_id, voter_id) DO NOTHING` with a
  **named conflict target** (so a 23505 with `err.constraint` is catchable — see ADR-0003), then the
  child `votes` insert(s) in the same transaction.

## Consequences

- One-human-one-vote is enforced by the DB regardless of ballot type.
- Idempotency replay is voter-scoped — a caller can only ever be handed **their own** receipt; a
  voter mismatch on an idempotency key is a hard error, never a replay.
- Conflict branching is deterministic: idempotency-key conflict → `200` replay own receipt;
  ballot-PK conflict → `409 ALREADY_VOTED`.
- `votes` remains the partitioned, append-only ledger of option choices for tallying.

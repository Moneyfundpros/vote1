# ADR-0005: Real-time results — single-leader snapshot + edge-polling as the primary path

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

A draft described the SSE worker as both "the one and only Redis subscriber" (a single point of
failure that blacks out all live results when it dies) **and** "run 2+ replicas each with its own
subscriber" (which races on the snapshot key and multiplies pub/sub delivery cost). It also read raw
sharded counters on every revalidation — `O(shards × revalidations)` billed Upstash commands, a cost
blowup on a hot national poll. No connection ceiling was defined for millions of viewers.

## Decision

Split aggregation from fan-out, and make polling the primary path:

- **Aggregation (exactly one leader per poll):** elected via a Redis lock
  `SET poll:{id}:agg-leader NX EX` with renewal. The leader sums shards **once per tick** and writes
  **one** `poll:{id}:snapshot` key. On leader death the lock expires and another instance takes over.
- **Fan-out (many stateless instances):** each just reads the snapshot and pushes to its connected
  clients. For **national scale, default to a managed realtime provider (Ably/Pusher)**
  (`REALTIME_PROVIDER=ably`); the self-hosted SSE worker is the fallback/low-scale option.
- **Reads consume one key:** `/api/polls/[id]/results` reads `poll:{id}:snapshot` (1 command),
  `Cache-Control: s-maxage=1, stale-while-revalidate=5`, so Cloudflare collapses millions of requests
  into ~1 origin hit/sec. **This polling path is the PRIMARY results experience**; SSE/realtime is an
  enhancement, so a realtime outage degrades to ~1s-stale polling, never a blackout.
- **Hot-path writes** only `INCR` option + total shards; **geo/demo breakdowns are derived from the
  Postgres reconcile**, not live counters. No per-vote `PUBLISH` — a coalesced per-poll dirty flag
  drives ticks, and the leader **heartbeat-refreshes** active polls regardless of publishes.

## Consequences

- No SPOF blackout; no snapshot write races; bounded Upstash command volume.
- Live geo/demo is slightly delayed (reconcile cadence) in exchange for large cost savings.
- The client uses a fallback ladder: RSC snapshot → SSE/realtime upgrade → polling.

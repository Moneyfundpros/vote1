# Architecture Decision Records

Each ADR records one load-bearing decision. **ADR-0001…0004 are the four build-blocker
reconciliations (R-A…R-D)** — they resolve fatal contradictions found in the design critique and
govern the vote-integrity and privacy cores. Read them before implementing the vote write path,
the KYC flow, or the results pipeline.

| ADR | Rule | Topic |
|---|---|---|
| [0001](0001-canonical-ballots-envelope.md) | R-A | Canonical vote model = `ballots` envelope |
| [0002](0002-receipts-non-partitioned.md) | R-B | Receipts in a non-partitioned table |
| [0003](0003-no-inline-hash-chain.md) | R-C | No inline hash chain on the write path → async Merkle anchoring |
| [0004](0004-kms-keyed-peppers.md) | R-D | KMS/HSM-keyed peppers (never in `process.env`) |
| [0005](0005-realtime-results-pipeline.md) | — | Single-leader snapshot + edge-polling-primary results |

Status legend: `Accepted` (binding) · `Proposed` · `Superseded`.

# Scheduled jobs (Upstash QStash)

Register these schedules in the Upstash QStash console (or via the API) pointing at the deployed
`/api/jobs/*` endpoints. Each handler verifies the QStash signature. Tune cadence per scale.

| Job | Endpoint | Suggested schedule | Purpose |
|---|---|---|---|
| Reconcile counters | `/api/jobs/reconcile-counters` | every 1–5 min per active poll | Incremental watermark delta → `poll_tally` (geo/demo/total) |
| Audit checkpoint | `/api/jobs/audit-checkpoint` | every 1–5 min per active poll | Merkle batch anchoring |
| Freeze results | `/api/jobs/freeze-results` | on poll close (enqueued) | Certify tally + export |
| Export build | `/api/jobs/export-build` | enqueued by freeze | Hash-stamped B2 export |
| Partition maintenance | `/api/jobs/partition-maintenance` | daily 02:00 | DETACH archived poll partitions |
| Retention sweep | `/api/jobs/retention-sweep` | daily | Drop aged provider_ref + security events |
| PII assertion | `/api/jobs/pii-assertion` | daily | Assert no forbidden ID columns exist |
| Decay trends | `/api/jobs/decay-trends` | hourly | Recompute trending scores |
| Media process | `/api/jobs/media-process` | enqueued on upload | Scan/transcode candidate media |
| Automod scan | `/api/jobs/automod-scan` | enqueued on post | Toxicity/spam review |
| Campaign send | `/api/jobs/campaign-send` | enqueued | Bulk Brevo send (Flow Control) |
| Receipt email | `/api/jobs/receipt-email` | enqueued on vote | Transactional receipt (Resend) |
| DLQ handler | `/api/jobs/dlq-handler` | failure callback | Dead-letter recording |

Per-poll jobs (reconcile, audit-checkpoint) are enqueued when a poll opens and can also be driven by
a fan-out cron that lists open polls and publishes one message per poll.

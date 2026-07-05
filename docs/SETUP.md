# Setup & Provisioning

This is a from-scratch build. Most external services need **your** accounts/credentials — the repo
ships the integration code, config, and env templates; you provision the services and fill `.env`.

## 1. Local prerequisites

- Node ≥ 20.11 (`nvm use` reads `.nvmrc`)
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- A Neon account, Upstash account, Backblaze B2 account, Cloudflare account, Resend + Brevo
  accounts, a Dojah (and Smile ID) account, and a KMS provider (AWS KMS / GCP KMS / Vault).

```bash
pnpm install
cp .env.example .env
```

## 2. Provision infrastructure (one-time)

> Region rule: co-locate everything in EU-Central / Frankfurt (no provider has a West-Africa
> region; Cloudflare's Lagos POP handles last-mile latency).

| Service | What to create | Env vars |
|---|---|---|
| **Neon** | Project in `eu-central-1`; prod primary (scale-to-zero OFF, autoscale max high) + ≥1 read replica. Copy the **pooled** (`-pooler`) and **direct** connection strings. | `DATABASE_URL`, `DATABASE_URL_DIRECT`, `DATABASE_URL_REPLICA` |
| **Upstash Redis** | EU primary DB (+ global read replicas for prod). | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Upstash QStash** | Enable; copy current + next signing keys; set DLQ failure callback to `/api/jobs/dlq-handler`. | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` |
| **Backblaze B2** | Buckets `voter-media` (public, CF-proxied), `voter-exports` (private, Object-Lock ON), `voter-uploads` (private). Per-bucket least-priv app keys + a separate read-only download key. | `B2_*` |
| **KMS/HSM** | Create HMAC/MAC keys for dedup, phone blind-index, receipt, risk. **App never holds the pepper** — it calls the KMS MAC op. | `KMS_*`, `PEPPER_KEY_VERSION` |
| **Resend** | Verify a transactional sending subdomain (e.g. `mail.<domain>`); SPF/DKIM/DMARC. | `RESEND_API_KEY`, `RESEND_FROM` |
| **Brevo** | API key; separate marketing subdomain; SMS sender id. | `BREVO_API_KEY`, `BREVO_SMS_SENDER` |
| **Dojah / Smile ID** | Sandbox keys first; configure webhook → `/api/webhooks/kyc/dojah`. | `DOJAH_*`, `SMILEID_*` |
| **Cloudflare** | DNS + proxied media/`stream` hosts; WAF + rate-limit; Turnstile site+secret. | `CLOUDFLARE_TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` |
| **Realtime** | For national scale set `REALTIME_PROVIDER=ably` and add `ABLY_API_KEY`; else `worker`. | `REALTIME_PROVIDER`, `ABLY_API_KEY` |
| **Railway** | Deploy `apps/worker`; expose as `stream.<domain>` behind Cloudflare; ≥1 always-on instance. | `SSE_WORKER_URL`, `WORKER_SHARED_SECRET` |

## 3. Database

```bash
pnpm db:generate      # generate Drizzle SQL from schema changes
pnpm db:migrate       # apply migrations + raw-SQL partition DDL via DATABASE_URL_DIRECT
pnpm db:seed          # seed regions (states/LGAs) + dev fixtures (non-prod only)
pnpm db:studio        # inspect with Drizzle Studio
```

Partition DDL (`votes` LIST-by-`poll_id` + HASH sub-partition) and append-only role grants run on
the **direct** host only — they break on the PgBouncer transaction-mode pooler.

## 4. Run

```bash
pnpm dev              # web → http://localhost:3000 ; worker → http://localhost:8080
```

## 5. Safety invariants (do not break)

- Peppers/MACs are computed in KMS — never read a pepper into `process.env` outside `local-dev`.
- Never persist raw NIN/BVN/vNIN/selfie. Sentry/pino deny-by-default on `/api/kyc/*`.
- Append-only tables (`audit_log`, `certified_results`, `vote_receipts`, `votes`) have UPDATE/DELETE
  revoked at the DB role level; corrections are new rows.
- The auditor DB role is read-only on the replica.

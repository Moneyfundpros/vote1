# Voter — Nigerian Public-Opinion Voting Platform

A trusted civic space where **identity-verified** Nigerians vote in opinion polls on elections,
governance, policy, and national issues. **Not** an official-election system — a credible,
transparent, anti-fraud public-sentiment platform.

> Mission pillars: public trust · transparency · security · one-verified-human-one-vote · easy participation.

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) on Vercel |
| Backend | Node.js — Next.js Route Handlers + a long-running worker (Railway) |
| Database | PostgreSQL on Neon (partitioned `votes`, read replica) |
| ORM | Drizzle |
| Cache / jobs / realtime | Upstash Redis + QStash |
| Object storage | Backblaze B2 (S3-compatible) |
| Email / SMS | Resend (transactional) + Brevo (bulk + SMS) |
| Identity (KYC) | Dojah (primary) + Smile ID (fallback) — NIN/BVN + phone |
| Auth | Auth.js (NextAuth), self-hosted |
| Edge / WAF / bot | Cloudflare (Turnstile) |
| Secrets / MAC | External KMS/HSM (peppers never in `process.env`) |

## Monorepo layout

```
apps/
  web/      Next.js App Router (Vercel) — pages + all /api routes
  worker/   Long-running Node service — SSE fan-out + heavy/streaming jobs
packages/
  db/       Drizzle schema + migrations + clients (pooled/direct/replica)
  core/     Domain services, repositories, zod validation, error taxonomy
  kyc/      KYC provider port (Dojah/Smile) + circuit breaker + dedup MAC
  redis/    Counters, ratelimit, publish helpers
  queue/    QStash typed publishers + signature verification
  storage/  Backblaze B2 presign helpers
  email/    EmailPort → Resend / Brevo + React Email templates
  security/ Risk engine, Turnstile, CSP/headers, audit-append, KMS MAC client
```

## Getting started

See [docs/SETUP.md](docs/SETUP.md). TL;DR:

```bash
pnpm install
cp .env.example .env          # fill in Neon / Upstash / B2 / KYC / KMS values
pnpm db:migrate               # apply schema + partition DDL (uses DATABASE_URL_DIRECT)
pnpm db:seed                  # regions (36 states + FCT + 774 LGAs) + sample data
pnpm dev                      # web on :3000, worker on :8080
```

## Architecture & design rules

The approved build plan and the four **build-blocker reconciliations** (R-A…R-D) that govern
vote integrity and privacy are documented in [docs/adr/](docs/adr/). Read these before touching
the vote write path — violating them reintroduces a critical bug.

## Phase status

- [x] **Phase 0** — Foundation scaffolding (in progress)
- [ ] **Phase 1** — MVP core voting loop (verify → poll → vote → live results)
- [ ] **Phase 2** — Candidate hub · analytics · transparency/audit · community
- [ ] **Phase 3** — Hardening · privacy/legal · scale · growth

# ADR-0004 (R-D): KMS/HSM-keyed peppers — never in `process.env`

- **Status:** Accepted (build blocker)
- **Date:** 2026-06-28

## Context

The one-human-one-vote dedup key is `HMAC(pepper, normalize(NIN‖BVN))`. NIN is only ~37 bits of
entropy (10¹¹) and BVN ~33 bits. An HMAC protects the preimage **only while the pepper is secret**.
If the pepper lives in `process.env`, any RCE, SSRF to cloud metadata, malicious dependency, or env
exfiltration leaks it — and an attacker computes the full NIN→dedup_key rainbow table offline in
minutes. They could then test whether any specific Nigerian's NIN is enrolled, re-link an "erased"
tombstoned account to a person, and correlate across systems. This collapses the legal claim that a
retained `dedup_hmac` is "no longer personal data" after erasure.

## Decision

- All low-entropy keyed digests are computed inside an **external KMS/HSM MAC operation** — the app
  sends the preimage and receives the digest, and **never holds the pepper**:
  - `dedup_hmac` (one-human-one-vote),
  - `phone_bidx` (phone blind index),
  - `receipt_hash` (vote receipt),
  - `ip_hmac` / `fp_hmac` (risk signals; plus a daily-rotating salt so they can't be long-term IDs).
- Implementations: AWS KMS HMAC keys, GCP KMS MAC, or HashiCorp Vault Transit `hmac`. A `local-dev`
  provider using an in-memory pepper is allowed **only** when `NODE_ENV !== 'production'`.
- Add a **per-derivation rate limit + audit** so even the keyed oracle can't be used to bulk-enumerate
  the NIN space.
- Peppers are **versioned** (`PEPPER_KEY_VERSION`); rotation re-derives on next verify, old versions
  stay valid under their version tag.

## Consequences

- A runtime compromise no longer yields the pepper, so the dedup space stays non-enumerable.
- The "erased data is non-personal" claim becomes defensible in the DPIA — but only **together with**
  treating `provider_ref` as PII (short retention, null on erasure) and severing the processor join.
- The `@voter/security` KMS MAC client is on the hot path of KYC finalize and vote receipt issuance;
  it must be low-latency and circuit-broken.

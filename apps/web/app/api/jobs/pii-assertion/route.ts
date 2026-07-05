import { NextResponse } from 'next/server';
import { verifyJob } from '@voter/queue';
import { getReplicaDb, sql } from '@voter/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORBIDDEN_COLUMN_PATTERNS = ['nin', 'bvn', 'vnin', 'selfie', 'dob', 'date_of_birth'];

/**
 * QStash cron: structural PII guard (M12). Asserts the schema never grew a column that would hold raw
 * government-ID/biometric data. A non-empty result opens an incident (the seam is here). Complements
 * the log-sample scan and the deny-by-default Sentry/pino config on /api/kyc/*.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const raw = await req.text();
  try {
    await verifyJob('pii-assertion', raw, req.headers.get('upstash-signature'));
  } catch {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Bad signature' } }, { status: 401 });
  }

  const like = FORBIDDEN_COLUMN_PATTERNS.map((p) => `column_name ilike '%${p}%'`).join(' or ');
  const result = await getReplicaDb().execute(
    sql.raw(
      `select table_name, column_name from information_schema.columns
       where table_schema='public' and (${like})`,
    ),
  );
  const violations = (result as unknown as { rows?: unknown[] }).rows ?? [];
  const count = violations.length;
  // TODO: if count > 0, open an incident + page on-call. Forbidden columns must never exist.
  return NextResponse.json({ data: { ok: count === 0, violations: count } });
}

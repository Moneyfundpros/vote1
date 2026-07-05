import { NextResponse } from 'next/server';
import { zPollId } from '@voter/core';
import { PollSignals } from '@voter/redis';

export const runtime = 'nodejs';

/**
 * GET /api/polls/[pollId]/results — the PRIMARY results path (ADR-0005). Reads the single
 * `poll:{id}:snapshot` key (O(1)) that the aggregation leader maintains. Edge-cached via the
 * Cache-Control header set in next.config.mjs (s-maxage=1, swr=5) so Cloudflare collapses the fan-out.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  const { pollId: raw } = await ctx.params;
  const pollId = zPollId.safeParse(raw);
  if (!pollId.success) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });
  }

  const snapshot = await new PollSignals().readSnapshot<unknown>(pollId.data);
  if (!snapshot) {
    // No snapshot yet (poll just opened / no votes) — return an empty shell, not an error.
    return NextResponse.json({ data: { pollId: pollId.data, total: 0, options: [], asOf: null } });
  }
  return NextResponse.json({ data: snapshot });
}

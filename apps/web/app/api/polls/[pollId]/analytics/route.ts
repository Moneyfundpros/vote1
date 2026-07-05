import { NextResponse } from 'next/server';
import { AnalyticsRepoDrizzle, zPollId } from '@voter/core';

export const runtime = 'nodejs';

const repo = new AnalyticsRepoDrizzle();

/**
 * GET /api/polls/[pollId]/analytics?breakdown=geo|demo|trend — advanced analytics derived from
 * poll_tally (geo/demo) and votes (trend) on the read replica. Geo/demo are consent-respecting.
 */
export async function GET(req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  const pollId = zPollId.safeParse((await ctx.params).pollId);
  if (!pollId.success) return NextResponse.json({ error: { code: 'VALIDATION', message: 'Invalid poll id' } }, { status: 422 });

  const breakdown = new URL(req.url).searchParams.get('breakdown') ?? 'geo';
  if (breakdown === 'trend') {
    return NextResponse.json({ data: { trend: await repo.trend(pollId.data) } });
  }
  if (breakdown === 'geo' || breakdown === 'demo') {
    return NextResponse.json({ data: { breakdown, rows: await repo.breakdown(pollId.data, breakdown) } });
  }
  return NextResponse.json({ error: { code: 'VALIDATION', message: 'Unknown breakdown' } }, { status: 422 });
}

import { NextResponse } from 'next/server';
import { AppError, voteSchema, zPollId } from '@voter/core';
import { and, eq, getReplicaDb, ballots, voteReceipts } from '@voter/db';
import { bytesToHex } from '@/server/encoding';
import { auth } from '@/server/auth';
import { voteService } from '@/server/wiring';
import { clientIp, errorResponse, respond } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/polls/[pollId]/vote — cast a vote (KYC-gated, one-verified-human-one-vote).
 * The integrity guarantee is the DB transaction (ADR-0001); this handler is a thin adapter.
 */
export async function POST(req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return errorResponse(new AppError('UNAUTHENTICATED', 'Sign in to vote'));

  const { pollId: pollIdRaw } = await ctx.params;
  const pollId = zPollId.safeParse(pollIdRaw);
  if (!pollId.success) return errorResponse(new AppError('VALIDATION', 'Invalid poll id'));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(new AppError('VALIDATION', 'Invalid JSON body'));
  }
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      new AppError('VALIDATION', 'Invalid vote', { fields: parsed.error.flatten().fieldErrors as Record<string, string[]> }),
    );
  }

  const result = await voteService().cast(userId, pollId.data, parsed.data, { remoteIp: clientIp(req) });
  return respond(result, 201);
}

/**
 * GET /api/polls/[pollId]/vote — has the caller voted, and their own receipt ref. Returns the public
 * hex ref of the receipt (no option_id), enabling "I voted" UI without exposing the choice.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ pollId: string }> }): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return errorResponse(new AppError('UNAUTHENTICATED'));
  const pollId = zPollId.safeParse((await ctx.params).pollId);
  if (!pollId.success) return errorResponse(new AppError('VALIDATION', 'Invalid poll id'));

  const rows = await getReplicaDb()
    .select({ castAt: ballots.castAt, receiptHash: voteReceipts.receiptHash })
    .from(ballots)
    .innerJoin(voteReceipts, eq(voteReceipts.id, ballots.receiptId))
    .where(and(eq(ballots.pollId, pollId.data), eq(ballots.voterId, userId)))
    .limit(1);

  const r = rows[0];
  if (!r) return NextResponse.json({ data: { voted: false } });
  return NextResponse.json({ data: { voted: true, recordedAt: r.castAt, receiptRef: bytesToHex(r.receiptHash) } });
}

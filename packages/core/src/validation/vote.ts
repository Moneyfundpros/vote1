import { z } from 'zod';
import { zPollId, zUuid } from './common';

/**
 * Vote submission. The client generates `idempotencyKey` (uuid) so retries of the same request are
 * recognised (200 replay) vs a genuine second vote (409). `optionIds` is an array to support
 * multi/ranked ballots; single-choice polls send exactly one. `ranks` aligns with optionIds for
 * ranked ballots.
 */
export const voteSchema = z
  .object({
    idempotencyKey: zUuid,
    optionIds: z.array(zPollId).min(1).max(50),
    ranks: z.array(z.number().int().min(1)).optional(),
    turnstileToken: z.string().min(1),
  })
  .refine((v) => !v.ranks || v.ranks.length === v.optionIds.length, {
    message: 'ranks must align 1:1 with optionIds',
    path: ['ranks'],
  });

export type VoteInput = z.infer<typeof voteSchema>;

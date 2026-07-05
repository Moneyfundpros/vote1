import { z } from 'zod';
import { POLL_KIND } from '@voter/db';
import { zStateCode, zVoteType } from './common';

export const pollCreateSchema = z.object({
  slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  kind: z.enum(POLL_KIND),
  voteType: zVoteType.default('single'),
  maxSelections: z.number().int().min(1).max(50).default(1),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  resultVisibility: z.enum(['live', 'after_close', 'certified_only']).default('live'),
  allowedStates: z.array(zStateCode).optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        candidateId: z.string().uuid().optional(),
        mediaObjectKey: z.string().optional(),
      }),
    )
    .min(2)
    .max(200),
});

export type PollCreateInput = z.infer<typeof pollCreateSchema>;

export const pollUpdateSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'open', 'closed', 'certified', 'archived']).optional(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(5000).optional(),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
});

export type PollUpdateInput = z.infer<typeof pollUpdateSchema>;

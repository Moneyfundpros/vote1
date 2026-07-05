import { z } from 'zod';
import { zStateCode } from './common';

export const candidateCreateSchema = z.object({
  fullName: z.string().min(2).max(160),
  partyCode: z.string().max(20).optional(),
  office: z.string().max(80).optional(),
  bio: z.string().max(10_000).optional(),
  homeStateCode: zStateCode.optional(),
  manifesto: z.record(z.unknown()).optional(),
});
export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;

export const candidateUpdateSchema = candidateCreateSchema.partial().extend({
  status: z.enum(['active', 'withdrawn', 'disqualified']).optional(),
  verifiedBadge: z.boolean().optional(),
});
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;

export const mediaPresignSchema = z.object({
  candidateId: z.string().uuid(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']),
  sizeBytes: z.number().int().positive().max(200 * 1024 * 1024),
});
export type MediaPresignInput = z.infer<typeof mediaPresignSchema>;

import { z } from 'zod';

export const threadCreateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(10_000),
  pollId: z.coerce.number().int().positive().optional(),
  candidateId: z.string().uuid().optional(),
});
export type ThreadCreateInput = z.infer<typeof threadCreateSchema>;

export const commentCreateSchema = z.object({
  body: z.string().min(1).max(10_000),
  parentId: z.string().uuid().optional(),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

export const reactSchema = z.object({ kind: z.enum(['up', 'down', 'flag']) });
export type ReactInput = z.infer<typeof reactSchema>;

export const qaAskSchema = z.object({
  body: z.string().min(5).max(2000),
  candidateId: z.string().uuid().optional(),
  pollId: z.coerce.number().int().positive().optional(),
});
export type QaAskInput = z.infer<typeof qaAskSchema>;

export const reportCreateSchema = z.object({
  targetType: z.enum(['post', 'thread', 'qa_question', 'candidate', 'user']),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(1000),
});
export type ReportCreateInput = z.infer<typeof reportCreateSchema>;

export const surveyRespondSchema = z.object({ answers: z.record(z.unknown()) });
export type SurveyRespondInput = z.infer<typeof surveyRespondSchema>;

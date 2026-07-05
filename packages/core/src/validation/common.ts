import { z } from 'zod';
import { AGE_BAND, ID_TYPE, VOTE_TYPE } from '@voter/db';

/** Reusable validation primitives shared by client forms and server handlers. */

export const zUuid = z.string().uuid();
export const zPollId = z.coerce.number().int().positive();
export const zCursor = z.string().optional();
export const zLimit = z.coerce.number().int().min(1).max(100).default(20);

// 36 states + FCT, ISO 3166-2:NG codes.
export const NG_STATE_CODES = [
  'NG-AB', 'NG-AD', 'NG-AK', 'NG-AN', 'NG-BA', 'NG-BY', 'NG-BE', 'NG-BO', 'NG-CR', 'NG-DE',
  'NG-EB', 'NG-ED', 'NG-EK', 'NG-EN', 'NG-GO', 'NG-IM', 'NG-JI', 'NG-KD', 'NG-KN', 'NG-KT',
  'NG-KE', 'NG-KO', 'NG-KW', 'NG-LA', 'NG-NA', 'NG-NI', 'NG-OG', 'NG-ON', 'NG-OS', 'NG-OY',
  'NG-PL', 'NG-RI', 'NG-SO', 'NG-TA', 'NG-YO', 'NG-ZA', 'NG-FC',
] as const;

export const zStateCode = z.enum(NG_STATE_CODES);
export const zAgeBand = z.enum(AGE_BAND);
export const zIdType = z.enum(ID_TYPE);
export const zVoteType = z.enum(VOTE_TYPE);

// E.164, Nigeria-friendly (+234…). Stored encrypted; validated here only.
export const zPhoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format, e.g. +2348012345678');

export const zPagination = z.object({ cursor: zCursor, limit: zLimit });

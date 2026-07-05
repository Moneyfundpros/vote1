import { z } from 'zod';
import { zIdType, zPhoneE164 } from './common';

/**
 * KYC start. The raw NIN/BVN is NEVER sent to our API — it is collected inside the provider widget.
 * We only receive the id TYPE + phone here, and a consent acknowledgement.
 */
export const verificationStartSchema = z.object({
  idType: zIdType,
  phone: zPhoneE164,
  consentPolicyVersion: z.string().min(1),
  turnstileToken: z.string().min(1),
});

export type VerificationStartInput = z.infer<typeof verificationStartSchema>;

export const otpRequestSchema = z.object({
  identifier: z.string().trim().min(1),
  turnstileToken: z.string().min(1),
});

export const otpVerifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

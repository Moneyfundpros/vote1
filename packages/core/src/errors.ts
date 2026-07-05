/**
 * Error taxonomy → HTTP mapping. Services return `Err(new AppError(...))`; route handlers map
 * `error.status` and `error.code` onto the response envelope `{ error: { code, message, fields? } }`.
 */
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'KYC_REQUIRED'
  | 'NOT_ELIGIBLE_REGION'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ALREADY_VOTED'
  | 'DUPLICATE_HUMAN'
  | 'POLL_CLOSED'
  | 'POLL_NOT_OPEN'
  | 'CONSENT_REQUIRED'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'KYC_SPEND_CAP'
  | 'PROVIDER_ERROR'
  | 'CONFLICT'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  KYC_REQUIRED: 403,
  NOT_ELIGIBLE_REGION: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ALREADY_VOTED: 409,
  DUPLICATE_HUMAN: 409,
  POLL_CLOSED: 409,
  POLL_NOT_OPEN: 409,
  CONSENT_REQUIRED: 403,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  KYC_SPEND_CAP: 429,
  PROVIDER_ERROR: 502,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string[]>;
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message?: string,
    opts?: { fields?: Record<string, string[]>; retryAfter?: number },
  ) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.fields = opts?.fields;
    this.retryAfter = opts?.retryAfter;
  }

  toBody(): { error: { code: ErrorCode; message: string; fields?: Record<string, string[]> } } {
    return {
      error: { code: this.code, message: this.message, ...(this.fields ? { fields: this.fields } : {}) },
    };
  }
}

export const err = (code: ErrorCode, message?: string, opts?: ConstructorParameters<typeof AppError>[2]) =>
  new AppError(code, message, opts);

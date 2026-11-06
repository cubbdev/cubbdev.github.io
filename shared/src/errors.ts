export const ERROR_CODES = {
  bad_request: 400,
  validation_failed: 400,
  unauthenticated: 401,
  invalid_license: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  replay_detected: 409,
  payload_too_large: 413,
  unsupported_file: 415,
  rate_limited: 429,
  internal_error: 500,
  upstream_unavailable: 503,
  feature_unavailable: 501,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}

export class CipherApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, code: ErrorCode | string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'CipherApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

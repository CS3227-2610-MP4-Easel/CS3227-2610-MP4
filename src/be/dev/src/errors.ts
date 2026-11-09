export type DevErrorCode = "AI_BUSY" | "RATE_LIMITED" | "AI_UNAVAILABLE" | "AI_DISABLED" | "VALIDATION_FAILED" | "INTERNAL_ERROR";

export class DevError extends Error {
  constructor(readonly code: DevErrorCode, readonly status: 422 | 429 | 500 | 503, readonly retryAfterSeconds?: number, readonly details?: readonly { field: string; message: string }[]) { super(code); this.name = "DevError"; }
}

export const LOCAL_LIMIT_DETAILS: readonly { field: string; message: string }[] = Object.freeze([Object.freeze({ field: "reason", message: "LOCAL_LIMIT" })]);

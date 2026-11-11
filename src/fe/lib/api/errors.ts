'use client';

export class ApiError extends Error {
  status: number;
  details: { field: string; message: string }[];
  requestId: string | null;
  retryAfterSeconds: number | null;
  constructor(
    public code: string,
    message: string,
    opts: {
      status?: number;
      details?: { field: string; message: string }[];
      requestId?: string | null;
      retryAfterSeconds?: number | null;
    } = {},
  ) {
    super(message);
    this.status = opts.status ?? 0;
    this.details = opts.details ?? [];
    this.requestId = opts.requestId ?? null;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
  }
}

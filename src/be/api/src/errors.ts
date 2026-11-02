import type { z } from "zod";

export class HttpError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly details?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = "HttpError";
  }
}

export async function parseJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new HttpError("BAD_REQUEST", 400, "Request content type must be application/json.");
  try { return await request.json(); } catch { throw new HttpError("BAD_REQUEST", 400, "Request body is not valid JSON."); }
}

export function parseInput<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError("VALIDATION_FAILED", 422, "The request body is not valid.", result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })));
  return result.data;
}

export function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (!value || typeof value !== "object") return value;
  const blocked = new Set(["authorization", "password", "token", "secret", "prompt", "response", "code", "credential"]);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, blocked.has(key.toLowerCase()) ? "[REDACTED]" : redactLogValue(child)]));
}

export function errorResponse(error: unknown, requestId: string): Response {
  const known = error instanceof HttpError ? error : new HttpError("INTERNAL_ERROR", 500, "Internal server error.");
  return Response.json({ error: { code: known.code, message: known.message, ...(known.details ? { details: known.details } : {}), requestId } }, { status: known.status, headers: { "X-Request-Id": requestId } });
}

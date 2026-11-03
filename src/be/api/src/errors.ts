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
  const seen = new WeakSet<object>();
  function visit(item: unknown): unknown {
    if (!item || typeof item !== "object") return item;
    if (seen.has(item)) return "[Circular]";
    seen.add(item);
    const result = Array.isArray(item) ? item.map(visit) : Object.fromEntries(Object.entries(item).map(([key, child]) => [key, /authorization|password|token|secret|prompt|response|code|credential|cookie|api.?key/i.test(key) ? "[REDACTED]" : visit(child)]));
    seen.delete(item);
    return result;
  }
  return visit(value);
}

export function errorResponse(error: unknown, requestId: string): Response {
  const known = error instanceof HttpError ? error : error instanceof Error && error.message === "NOT_FOUND" ? new HttpError("NOT_FOUND", 404, "The requested resource was not found.") : error instanceof Error && error.message === "CONFLICT_STATE" ? new HttpError("CONFLICT_STATE", 409, "The project or resource is archived.") : new HttpError("INTERNAL_ERROR", 500, "Internal server error.");
  return Response.json({ error: { code: known.code, message: known.message, ...(known.details ? { details: known.details } : {}), requestId } }, { status: known.status, headers: { "X-Request-Id": requestId } });
}

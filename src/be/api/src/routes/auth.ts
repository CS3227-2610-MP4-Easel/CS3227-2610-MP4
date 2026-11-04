import { z } from "zod";
import { policyForRoute, type RouteDefinition } from "@agile/contracts";
import { checkRegistrationCode, clientIpKey, type AuthRuntime, type RatePurpose } from "@agile/auth";
import { errorResponse, HttpError } from "../errors.js";

const MAX_BODY_BYTES = 4096;
const fixed = (message: string) => ({ errorMap: () => ({ message }) });
// Fixed messages only: parseInput copies each zod message into `details`, and zod's defaults quote the submitted value (E17).
const RoleField = z.enum(["PM", "DEV_LEAD", "DEVELOPER"], fixed("Must be PM, DEV_LEAD or DEVELOPER."));
const CodeField = z.string(fixed("Must be 1 to 128 characters.")).min(1).max(128);
export const CheckCodeBodySchema = z.object({ role: RoleField, code: CodeField }, fixed("Invalid request body.")).strict("Unknown field.");

const tooLarge = (requestId: string) => errorResponse(new HttpError("PAYLOAD_TOO_LARGE", 413, "The request body is too large."), requestId);

/** Counts body bytes as they stream in and stops past the limit, so an oversized body is never buffered whole. */
async function bodyTooLarge(request: Request): Promise<boolean> {
  const length = request.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) return true;
  const reader = request.clone().body?.getReader();
  if (!reader) return false;
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return false;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { await reader.cancel(); return true; }
  }
}

/** Pipeline step 2 for endpoints 2 and 3: count the attempt per client IP, then cap the body size, before authorization or parsing. */
function limitedBefore(runtime: () => AuthRuntime, purpose: RatePurpose): NonNullable<RouteDefinition["before"]> {
  return async ({ requestId, request }) => {
    const { settings, hit } = runtime();
    if (settings.rateKeySecret === null) return errorResponse(new Error("AUTH_NOT_CONFIGURED"), requestId);
    const forwardedFor = request.headers.get("x-vercel-forwarded-for");
    const key = clientIpKey(purpose, forwardedFor, settings.rateKeySecret);
    if ((settings.tier === "dev" || settings.tier === "prod") && key === clientIpKey(purpose, null, settings.rateKeySecret)) console.warn("client_ip_missing");
    const { allowed, retryAfterSeconds } = await hit(key, 60, 20);
    if (!allowed) {
      const response = errorResponse(new HttpError("RATE_LIMITED", 429, "Too many attempts."), requestId);
      response.headers.set("Retry-After", String(retryAfterSeconds));
      return response;
    }
    if (await bodyTooLarge(request)) return tooLarge(requestId);
  };
}

const route = (policyKey: string): Pick<RouteDefinition, "operationId" | "method" | "path" | "policyKey"> => {
  const policy = policyForRoute(policyKey);
  return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey };
};

/** Endpoints 2 to 4 (spec `api.md`); `runtime` is read per request so tests can pass a fake. */
export function authRoutes(runtime: () => AuthRuntime): RouteDefinition[] {
  return [
    {
      ...route("endpoint-2"),
      bodySchema: CheckCodeBodySchema,
      responseSchema: {},
      before: limitedBefore(runtime, "check-code"),
      handler: async ({ input }) => {
        const codes = runtime().settings.registrationCodes;
        if (!codes) throw new Error("AUTH_NOT_CONFIGURED");
        const { role, code } = input.body as z.infer<typeof CheckCodeBodySchema>;
        if (!checkRegistrationCode(codes, role, code)) throw new HttpError("REGISTRATION_CODE_INVALID", 403, "The registration code is not valid for this role.");
        return Response.json({ valid: true });
      },
    },
  ];
}

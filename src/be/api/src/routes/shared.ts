import { policyForRoute, type RouteDefinition } from "@agile/contracts";

export const route = (policyKey: string): Pick<RouteDefinition, "operationId" | "method" | "path" | "policyKey"> => {
  const policy = policyForRoute(policyKey);
  return { operationId: policy.operationId, method: policy.method, path: policy.path, policyKey };
};

/** Counts body bytes as they stream in and stops past the limit, so an oversized body is never buffered whole. */
export async function bodyTooLarge(request: Request, max: number): Promise<boolean> {
  const length = request.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > max) return true;
  const reader = request.clone().body?.getReader();
  if (!reader) return false;
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return false;
    total += value.byteLength;
    // Not awaited: cancelling one branch of a cloned body settles only when the other branch is cancelled too.
    if (total > max) { reader.cancel().catch(() => {}); return true; }
  }
}

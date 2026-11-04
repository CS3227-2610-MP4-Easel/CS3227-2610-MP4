export type HitResult = { allowed: boolean; retryAfterSeconds: number };
/** Fixed signature for W2: throws `RangeError` on bad input before touching the database; database failures propagate. */
export type Hit = (key: string, windowSeconds: number, limit: number) => Promise<HitResult>;
export type RateCounter = (key: string, windowSeconds: number) => Promise<{ count: number; remainingSeconds: number }>;

export function createHit(counter: RateCounter): Hit {
  void counter;
  return async () => { throw new Error("NOT_IMPLEMENTED"); };
}

export type RatePurpose = "check-code" | "register";

/** `ip:<hex HMAC-SHA256>` over `<purpose>:<ip>`, from the first `x-vercel-forwarded-for` value; IPv6 to /64, mapped IPv4 unwrapped, else `unknown`. */
export function clientIpKey(purpose: RatePurpose, forwardedFor: string | null, rateKeySecret: string): string {
  void purpose; void forwardedFor; void rateKeySecret;
  throw new Error("NOT_IMPLEMENTED");
}

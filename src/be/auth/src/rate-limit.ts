import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export type HitResult = { allowed: boolean; retryAfterSeconds: number };
/** Fixed signature for W2: throws `RangeError` on bad input before touching the database; database failures propagate. */
export type Hit = (key: string, windowSeconds: number, limit: number) => Promise<HitResult>;
export type RateCounter = (key: string, windowSeconds: number) => Promise<{ count: number; remainingSeconds: number }>;

export function createHit(counter: RateCounter): Hit {
  return async (key, windowSeconds, limit) => {
    if (key.length < 1 || key.length > 200) throw new RangeError("hit key must be 1 to 200 characters");
    if (!Number.isInteger(windowSeconds) || windowSeconds < 1) throw new RangeError("hit windowSeconds must be a positive integer");
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("hit limit must be a positive integer");
    const { count, remainingSeconds } = await counter(key, windowSeconds);
    if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };
    // Millisecond rounding can put remainingSeconds one past the window, so clamp to 1..windowSeconds.
    return { allowed: false, retryAfterSeconds: Math.min(Math.max(remainingSeconds, 1), windowSeconds) };
  };
}

export type RatePurpose = "check-code" | "register";

/** `ip:<hex HMAC-SHA256>` over `<purpose>:<ip>`, from the first `x-vercel-forwarded-for` value; IPv6 to /64, mapped IPv4 unwrapped, else `unknown`. */
export function clientIpKey(purpose: RatePurpose, forwardedFor: string | null, rateKeySecret: string): string {
  const ip = normaliseIp((forwardedFor ?? "").split(",")[0].trim());
  return `ip:${createHmac("sha256", rateKeySecret).update(`${purpose}:${ip}`).digest("hex")}`;
}

function normaliseIp(value: string): string {
  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return "unknown";
  const groups = expandIpv6(value);
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  // A client usually controls a whole /64, so the limiter keys on the prefix (SD7).
  return `${groups.slice(0, 4).map((g) => g.toString(16)).join(":")}::/64`;
}

/** Eight 16-bit groups; handles `::` and a trailing dotted IPv4. Input is already a valid IPv6 address. */
function expandIpv6(value: string): number[] {
  let text = value.toLowerCase().split("%")[0];
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    text = `${text.slice(0, -dotted[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.includes("::") ? text.split("::") : [text, undefined];
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const middle = tail === undefined ? [] : Array(8 - left.length - right.length).fill("0");
  return [...left, ...middle, ...right].map((g) => parseInt(g, 16));
}

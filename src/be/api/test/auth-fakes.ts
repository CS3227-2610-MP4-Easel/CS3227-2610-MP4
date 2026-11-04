import type { FilteredDbClient } from "@agile/db";
import { createLookupRegisteredUser, createResolvePrincipal, InvalidToken, VerifierUnavailable, type AuthRuntime, type AuthSettings, type TokenVerifier } from "@agile/auth";
import { createApiApp, createAppDependencies } from "../src/index.js";
import { authRoutes } from "../src/routes/auth.js";

/** Shared fakes for the auth route tests: a token table, an in-memory `users` table and an in-memory `hit`. */
export const tokens: Record<string, { uid: string; email: string | null }> = { "Bearer good": { uid: "uid-1", email: "a@b.test" }, "Bearer norow": { uid: "uid-2", email: "c@d.test" } };
export const fakeVerifier = (behaviour: "ok" | "invalid" | "down" = "ok"): TokenVerifier => ({
  verify: async (token) => {
    if (behaviour === "invalid") throw new InvalidToken();
    if (behaviour === "down") throw new VerifierUnavailable();
    const found = tokens[`Bearer ${token}`];
    if (!found) throw new InvalidToken();
    return found;
  },
});

export type UserRow = { id: string; firebaseUid: string; email: string; displayName: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" };
/** `findUnique` by `firebaseUid` or `id`; `create` throws a P2002-coded error on a duplicate uid or email, or `failure` if set. */
export const usersDb = (rows: UserRow[] = [], options: { findFails?: boolean; createFailure?: Error } = {}) => ({
  rows,
  user: {
    findUnique: async ({ where }: { where: { firebaseUid?: string; id?: string } }) => {
      if (options.findFails) throw new Error("db down");
      return rows.find((r) => (where.id ? r.id === where.id : r.firebaseUid === where.firebaseUid)) ?? null;
    },
    create: async ({ data }: { data: Omit<UserRow, "id"> }) => {
      if (options.createFailure) throw options.createFailure;
      if (rows.some((r) => r.firebaseUid === data.firebaseUid || r.email === data.email)) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      const row = { id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(12, "0")}`, ...data };
      rows.push(row);
      return { ...row, createdAt: new Date(0) };
    },
  },
}) as unknown as FilteredDbClient & { rows: UserRow[] };

export const secret = "s".repeat(32);
export const codes = { PM: "pm-code-123456789", DEV_LEAD: "lead-code-12345678", DEVELOPER: "dev-code-123456789" };
export const settings = (overrides: Partial<AuthSettings> = {}): AuthSettings => ({ tier: "test", firebaseProjectId: "w4-test", registrationCodes: codes, rateKeySecret: secret, ...overrides });

export const fakeRuntime = (options: { settings?: AuthSettings; hitFails?: boolean; db?: FilteredDbClient; verifier?: TokenVerifier } = {}) => {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  const db = options.db ?? usersDb([{ id: "00000000-0000-4000-8000-000000000001", firebaseUid: "uid-1", email: "a@b.test", displayName: "A", role: "PM" }]);
  const runtime: AuthRuntime = {
    settings: options.settings ?? settings(),
    hit: async (key, _windowSeconds, limit) => {
      if (options.hitFails) throw new Error("db down");
      keys.push(key);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count <= limit ? { allowed: true, retryAfterSeconds: 0 } : { allowed: false, retryAfterSeconds: 42 };
    },
    db,
    resolvePrincipal: createResolvePrincipal(options.verifier ?? fakeVerifier()),
    lookupRegisteredUser: createLookupRegisteredUser(db),
  };
  return { runtime, keys };
};

/** The real app (request id, error logging, not-found) with only the auth routes, wired to `runtime`. */
export const authApp = (runtime: AuthRuntime) => createApiApp(createAppDependencies(runtime), authRoutes(() => runtime));

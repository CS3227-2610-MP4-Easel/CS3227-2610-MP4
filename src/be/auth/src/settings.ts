import type { UserRole } from "@agile/contracts";

export type AppTier = "local" | "dev" | "preview" | "prod" | "test";

/** Data settings are null on previews other than dev (AD-53); routes needing them then return 500 `INTERNAL`. */
export type AuthSettings = {
  tier: AppTier;
  firebaseProjectId: string | null;
  registrationCodes: Record<UserRole, string> | null;
  rateKeySecret: string | null;
};

/** Pure over an env map; throws naming the failing setting, never its value (N4). */
export function loadAuthSettings(env: Record<string, string | undefined>): AuthSettings {
  void env;
  throw new Error("NOT_IMPLEMENTED");
}

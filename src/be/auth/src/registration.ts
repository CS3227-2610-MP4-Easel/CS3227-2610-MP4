import crypto from "node:crypto";
import type { User, UserRole } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";

export class AlreadyRegistered extends Error { constructor() { super("ALREADY_REGISTERED"); this.name = "AlreadyRegistered"; } }

/** Exact comparison along a constant path, whatever the role or code length. */
export function checkRegistrationCode(codes: Record<UserRole, string>, role: UserRole, code: string): boolean {
  // Hashing first gives equal-length buffers, so timingSafeEqual never shortcuts on length (N2).
  const digest = (value: string) => crypto.createHash("sha256").update(value, "utf8").digest();
  return crypto.timingSafeEqual(digest(code), digest(codes[role]));
}

export type NewUser = { firebaseUid: string; email: string; displayName: string; role: UserRole };

/** One insert; a unique violation on `firebase_uid` or `email` throws `AlreadyRegistered`. */
export async function createUser(db: FilteredDbClient, user: NewUser): Promise<User> {
  try {
    return toUser(await db.user.create({ data: user, select: USER_FIELDS }));
  } catch (error) {
    // Checked by code, not instanceof: errors pass through the filtered client's extension wrapper.
    if ((error as { code?: unknown }).code === "P2002") throw new AlreadyRegistered();
    throw error;
  }
}

/** The caller's own row for endpoint 4; throws `Error("USER_NOT_REGISTERED")` if it is gone. */
export async function getUser(db: FilteredDbClient, userId: string): Promise<User> {
  const row = await db.user.findUnique({ where: { id: userId }, select: USER_FIELDS });
  if (!row) throw new Error("USER_NOT_REGISTERED");
  return toUser(row);
}

const USER_FIELDS = { id: true, email: true, displayName: true, role: true } as const;
/** Only the contract's fields, so internal columns such as `firebase_uid` never reach a response. */
const toUser = ({ id, email, displayName, role }: User): User => ({ id, email, displayName, role });

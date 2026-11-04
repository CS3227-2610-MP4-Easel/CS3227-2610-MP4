import type { User, UserRole } from "@agile/contracts";
import type { FilteredDbClient } from "@agile/db";

export class AlreadyRegistered extends Error { constructor() { super("ALREADY_REGISTERED"); this.name = "AlreadyRegistered"; } }

/** Exact comparison along a constant path, whatever the role or code length. */
export function checkRegistrationCode(codes: Record<UserRole, string>, role: UserRole, code: string): boolean {
  void codes; void role; void code;
  throw new Error("NOT_IMPLEMENTED");
}

export type NewUser = { firebaseUid: string; email: string; displayName: string; role: UserRole };

/** One insert; a unique violation on `firebase_uid` or `email` throws `AlreadyRegistered`. */
export async function createUser(db: FilteredDbClient, user: NewUser): Promise<User> {
  void db; void user;
  throw new Error("NOT_IMPLEMENTED");
}

/** The caller's own row for endpoint 4; throws `Error("USER_NOT_REGISTERED")` if it is gone. */
export async function getUser(db: FilteredDbClient, userId: string): Promise<User> {
  void db; void userId;
  throw new Error("NOT_IMPLEMENTED");
}

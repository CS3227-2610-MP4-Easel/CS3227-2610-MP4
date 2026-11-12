import { HttpError } from "../errors.js";
import type { AuthDependencies, Principal } from "./auth.js";

const notFound = () => new Error("NOT_FOUND");
/** Roles a caller may add or remove (contracts.md endpoints 10 and 11): PM adds DEV_LEAD, DEV_LEAD adds DEVELOPER. */
const ADDABLE_ROLE: Readonly<Record<Principal["role"], Principal["role"] | undefined>> = { PM: "DEV_LEAD", DEV_LEAD: "DEVELOPER", DEVELOPER: undefined };

/** The shared `evaluatePredicate` for `AuthDependencies`. Failed lookups throw `NOT_FOUND` so existence is never confirmed;
 * only a role that may not manage the target (`ADDER`) is a 422. The resolver supplies `ownerId`, `assigneeId` (a user id) and
 * `targetRole`; `requireMember` is the membership check the caller's deployment injects. */
export function createPredicateEvaluator(requireMember: AuthDependencies["requireMember"]): AuthDependencies["evaluatePredicate"] {
  const requireAllMember = async (userId: string, projectIds: string[]) => { for (const projectId of projectIds) await requireMember(userId, projectId); };
  return async (predicate, principal, _request, resolved) => {
    switch (predicate) {
      case "NONE": return;
      case "MEMBER":
      case "MEMBER_PROJECTS":
        if (!resolved) throw notFound();
        if (resolved.kind === "PROJECT_SET") return requireAllMember(principal.userId, resolved.projectIds);
        if (predicate === "MEMBER_PROJECTS" || !resolved.projectId) throw notFound();
        return; // authorizeRequest already ran requireMember for a single project
      case "SELF":
        if (!resolved || resolved.kind === "PROJECT_SET" || resolved.ownerId !== principal.userId) throw notFound();
        return;
      case "ASSIGNEE":
        if (!resolved || resolved.kind === "PROJECT_SET" || !resolved.assigneeId || resolved.assigneeId !== principal.userId) throw notFound();
        return;
      case "MEMBER_OR_ASSIGNEE":
        if (!resolved || resolved.kind === "PROJECT_SET" || !resolved.projectId) throw notFound();
        if (principal.role === "DEV_LEAD") return requireMember(principal.userId, resolved.projectId);
        if (principal.role === "DEVELOPER" && resolved.assigneeId === principal.userId) return;
        throw notFound();
      case "ADDER": {
        if (!resolved || resolved.kind === "PROJECT_SET") throw notFound();
        const addable = ADDABLE_ROLE[principal.role];
        if (!addable || resolved.targetRole !== addable) throw new HttpError("VALIDATION_FAILED", 422, "The caller's role cannot manage a member of that role.", [{ field: "role", message: `A ${principal.role} may only manage ${addable ?? "no"} members.` }]);
        return;
      }
    }
  };
}

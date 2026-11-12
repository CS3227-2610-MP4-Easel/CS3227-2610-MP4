export type ProposalErrorCode = "NOT_FOUND" | "CONFLICT_STATE" | "CONFLICT_VERSION" | "FORBIDDEN_ROLE" | "INVALID_PLAN";

export class ProposalError extends Error {
  constructor(readonly code: ProposalErrorCode) {
    super(code);
    this.name = "ProposalError";
  }
}

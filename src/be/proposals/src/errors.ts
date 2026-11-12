export type ProposalErrorCode = "NOT_FOUND" | "CONFLICT_STATE" | "CONFLICT_VERSION" | "FORBIDDEN_ROLE" | "INVALID_PLAN" | "VALIDATION_FAILED";

export class ProposalError extends Error {
  constructor(readonly code: ProposalErrorCode, readonly field?: string) {
    super(code);
    this.name = "ProposalError";
  }
}

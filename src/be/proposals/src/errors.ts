export type ProposalErrorCode = "NOT_FOUND" | "CONFLICT_STATE" | "CONFLICT_VERSION" | "FORBIDDEN_ROLE" | "INVALID_PLAN" | "VALIDATION_FAILED";

export class ProposalError extends Error {
  readonly field?: string;
  readonly details?: Record<string, unknown>;
  constructor(readonly code: ProposalErrorCode, detail?: string | Record<string, unknown>) {
    super(code);
    this.name = "ProposalError";
    this.field = typeof detail === "string" ? detail : undefined;
    this.details = typeof detail === "object" ? detail : undefined;
  }
}

/** A source returned a row outside its section's rules; it names the source and the check, never the row (spec N1). */
export class ContextScopeViolation extends Error {
  readonly sourceId: string;
  readonly check: string;
  constructor(sourceId: string, check: string) {
    super(`CONTEXT_SCOPE_VIOLATION:${sourceId}:${check}`);
    this.name = "ContextScopeViolation";
    this.sourceId = sourceId;
    this.check = check;
  }
}

import type { ContextSections } from "@agile/contracts";
export const LEAD_STATIC_SECTIONS: ContextSections = [
  { name: "lead-rules", kind: "STATIC", priority: 0, budgetTokens: 300, trusted: true, text: "Return a concise project digest and zero or more closed suggestions. Use only the supplied facts and changes. Never include URLs, HTML, or markdown links.", },
  { name: "lead-format", kind: "STATIC", priority: 0, budgetTokens: 200, trusted: true, text: "Output JSON: { explanation: string, suggestions: [{ id, type, checkpointId?, newTargetDate?, epicId?, taskId?, assigneeId?, rationale }] }. Keep ids from the supplied project facts.", },
];

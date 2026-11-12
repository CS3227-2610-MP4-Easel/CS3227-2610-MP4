import { registerMockResponse } from "@agile/llm-gateway";
export function registerLeadMock(): void { registerMockResponse("LEAD_DIGEST", () => JSON.stringify({ explanation: "No changes require attention.", suggestions: [] })); }

import { registerMockResponse } from "../gateway-binding.js";

export function registerDevMocks(): void {
  registerMockResponse("DEV_SUMMARY", (call) => {
    const text = call.sections.find((s) => s.name === "activity-items")?.text ?? "";
    const lines = text.split("\n").filter((l) => l.length > 0);
    return JSON.stringify({ items: lines.map((_, i) => ({ n: i + 1, oneLiner: `Summary of item ${i + 1}` })) });
  });
  registerMockResponse("DEV_STANDUP", () => JSON.stringify({ yesterday: ["Worked on recorded activity"], today: ["Continue recorded work"], blockers: [] }));
}

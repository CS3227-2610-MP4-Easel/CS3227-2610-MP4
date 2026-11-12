import { registerMockResponse } from "@agile/llm-gateway";
import { addDaysIso } from "./schemas.js";

registerMockResponse("PM_PLAN_OUTLINE", (call) => {
  const today = call.sections.find((section) => section.name === "today")?.text;
  if (!today) throw new Error("MOCK_TODAY_MISSING");
  return JSON.stringify({
    approach: "A short mock plan.",
    checkpoints: [{ name: "MVP", targetDate: addDaysIso(today, 28) }],
    epics: [
      { title: "Foundation", description: "Set up the base of the product.", checkpointName: null },
      { title: "Core features", description: "Build the features users need first.", checkpointName: "MVP" },
      { title: "Release", description: "Prepare and ship the first release.", checkpointName: null },
    ],
  });
});

registerMockResponse("PM_PLAN_EXPAND", () =>
  JSON.stringify({
    tasks: [
      { title: "Design", description: "Sketch the approach for this epic.", acceptanceCriteria: ["The design is agreed."], storyPoints: 3 },
      { title: "Build", description: "Implement the agreed design.", acceptanceCriteria: ["The feature works as designed."], storyPoints: 5 },
      { title: "Test", description: "Check the result against the criteria.", acceptanceCriteria: ["All checks pass."], storyPoints: 2 },
    ],
  }));

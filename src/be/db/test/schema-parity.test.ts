import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const requiredModels = ["User", "Project", "ProjectMember", "Checkpoint", "Epic", "Sprint", "Task", "TaskEvent", "AiProposal", "ProposalEpic", "AiSession", "LlmCall", "LlmGatewayState", "RateCounter", "ActivityItem", "ItemSummary", "Standup", "ProjectDigest"];

test("F4 architecture model set and server-managed fields are present", async () => {
  const schema = await readFile(schemaPath, "utf8");
  for (const model of requiredModels) assert.match(schema, new RegExp(`model ${model} \\{`));
  assert.match(schema, /@@id\(\[projectId, userId\]\)/);
  assert.match(schema, /@relation\(fields: \[projectId, checkpointId\], references: \[projectId, id\]/);
  assert.match(schema, /deletedAt DateTime\? @map\("deleted_at"\)/);
  assert.match(schema, /version Int @default\(1\)/);
});

test("N3/E9 schema retains project ids in child foreign-key definitions", async () => {
  const schema = await readFile(schemaPath, "utf8");
  assert.match(schema, /fields: \[projectId, epicId\], references: \[projectId, id\]/);
  assert.match(schema, /fields: \[projectId, sprintId\], references: \[projectId, id\]/);
  assert.match(schema, /fields: \[projectId, assigneeId\], references: \[projectId, userId\]/);
});

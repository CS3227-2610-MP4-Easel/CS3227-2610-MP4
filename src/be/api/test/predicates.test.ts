import assert from "node:assert/strict";
import { test } from "node:test";
import { type ResolvedResource } from "@agile/contracts";
import { createPredicateEvaluator, type Principal } from "../src/index.js";

const members = new Set(["lead:p1", "dev:p1"]);
const evaluate = createPredicateEvaluator(async (userId, projectId) => { if (!members.has(`${userId}:${projectId}`)) throw new Error("NOT_FOUND"); });
const user = (userId: string, role: Principal["role"]): Principal => ({ firebaseUid: "f", userId, role });
const request = { method: "GET", path: "/", params: {}, query: new URLSearchParams(), body: undefined };
const task = (extra: Partial<Extract<ResolvedResource, { projectId: string | null }>> = {}): ResolvedResource => ({ kind: "TASK", projectId: "p1", state: "ACTIVE", ...extra });
const membership = (targetRole?: "PM" | "DEV_LEAD" | "DEVELOPER"): ResolvedResource => ({ kind: "MEMBERSHIP", projectId: "p1", state: "ACTIVE", ...(targetRole ? { targetRole } : {}) });
const run = (predicate: Parameters<typeof evaluate>[0], principal: Principal, resolved: ResolvedResource | null) => evaluate(predicate, principal, request, resolved);
const hidden = (error: unknown) => error instanceof Error && error.message === "NOT_FOUND";
const unprocessable = (error: unknown) => (error as { code?: string }).code === "VALIDATION_FAILED" && (error as { status?: number }).status === 422;

test("NONE needs nothing; MEMBER needs a project; MEMBER_PROJECTS needs a project set", async () => {
  await run("NONE", user("x", "PM"), null);
  await run("MEMBER", user("lead", "DEV_LEAD"), task());
  await assert.rejects(() => run("MEMBER", user("lead", "DEV_LEAD"), null), hidden);
  await assert.rejects(() => run("MEMBER", user("lead", "DEV_LEAD"), task({ projectId: null })), hidden);
  await assert.rejects(() => run("MEMBER_PROJECTS", user("lead", "DEV_LEAD"), task()), hidden);
});

test("a project set must contain only projects the principal belongs to", async () => {
  await run("MEMBER_PROJECTS", user("lead", "DEV_LEAD"), { kind: "PROJECT_SET", projectIds: ["p1"] });
  await run("MEMBER", user("lead", "DEV_LEAD"), { kind: "PROJECT_SET", projectIds: [] });
  await assert.rejects(() => run("MEMBER_PROJECTS", user("lead", "DEV_LEAD"), { kind: "PROJECT_SET", projectIds: ["p1", "p2"] }), hidden);
});

test("SELF and ASSIGNEE compare the resolved owner or assignee to the principal", async () => {
  await run("SELF", user("dev", "DEVELOPER"), task({ ownerId: "dev" }));
  await assert.rejects(() => run("SELF", user("dev", "DEVELOPER"), task({ ownerId: "other" })), hidden);
  await assert.rejects(() => run("SELF", user("dev", "DEVELOPER"), task()), hidden);
  await assert.rejects(() => run("SELF", user("dev", "DEVELOPER"), { kind: "PROJECT_SET", projectIds: [] }), hidden);
  await run("ASSIGNEE", user("dev", "DEVELOPER"), task({ assigneeId: "dev" }));
  await assert.rejects(() => run("ASSIGNEE", user("dev", "DEVELOPER"), task({ assigneeId: "other" })), hidden);
  await assert.rejects(() => run("ASSIGNEE", user("dev", "DEVELOPER"), task()), hidden);
});

test("MEMBER_OR_ASSIGNEE: DEV_LEAD must be a member, DEVELOPER must be the assignee", async () => {
  await run("MEMBER_OR_ASSIGNEE", user("lead", "DEV_LEAD"), task());
  await assert.rejects(() => run("MEMBER_OR_ASSIGNEE", user("outsider", "DEV_LEAD"), task()), hidden);
  await run("MEMBER_OR_ASSIGNEE", user("dev", "DEVELOPER"), task({ assigneeId: "dev" }));
  await assert.rejects(() => run("MEMBER_OR_ASSIGNEE", user("dev", "DEVELOPER"), task({ assigneeId: "other" })), hidden);
  await assert.rejects(() => run("MEMBER_OR_ASSIGNEE", user("pm", "PM"), task({ assigneeId: "pm" })), hidden);
  await assert.rejects(() => run("MEMBER_OR_ASSIGNEE", user("lead", "DEV_LEAD"), task({ projectId: null })), hidden);
});

test("ADDER: PM manages DEV_LEAD, DEV_LEAD manages DEVELOPER, nobody else; mismatches are 422", async () => {
  await run("ADDER", user("pm", "PM"), membership("DEV_LEAD"));
  await run("ADDER", user("lead", "DEV_LEAD"), membership("DEVELOPER"));
  await assert.rejects(() => run("ADDER", user("pm", "PM"), membership("DEVELOPER")), unprocessable);
  await assert.rejects(() => run("ADDER", user("lead", "DEV_LEAD"), membership("DEV_LEAD")), unprocessable);
  await assert.rejects(() => run("ADDER", user("lead", "DEV_LEAD"), membership()), unprocessable);
  await assert.rejects(() => run("ADDER", user("dev", "DEVELOPER"), membership("DEVELOPER")), unprocessable);
  await assert.rejects(() => run("ADDER", user("pm", "PM"), null), hidden);
});

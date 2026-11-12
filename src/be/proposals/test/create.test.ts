import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createDbClient, type FilteredDbClient } from "@agile/db";
import { createProposal, ProposalError, type CreateProposalInput } from "../src/index.js";
import { integrationUrl, withIntegrationDb } from "./fakes.js";

const hash = (title: string, description: string, checkpointName: string | null) =>
  createHash("sha256").update(`${title}\n${description}\n${checkpointName ?? ""}`).digest("hex");

const baseInput = (projectId: string, creatorId: string, sessionId: string): CreateProposalInput => ({
  projectId, creatorId, sessionId, flagged: true, approach: "Ship in two steps",
  checkpoints: [{ name: "Alpha", targetDate: "2026-12-01" }],
  retrieved: [],
  epics: [
    { title: "Epic one", description: "First", checkpointName: "Alpha" },
    { title: "Epic two", description: "Second", checkpointName: null },
    { title: "Epic three", description: "", checkpointName: null },
  ],
});

test("E7 a valid stage 1 answer stores one PENDING proposal and one row per epic", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm = await f.user();
    const projectId = await f.project(pm);
    await f.member(projectId, pm);
    const itemId = await f.epic(projectId);
    const sessionId = await f.aiSession(pm, projectId);
    const db = createDbClient(base);
    const input = { ...baseInput(projectId, pm, sessionId), retrieved: [{ source: "EPIC" as const, projectId, id: itemId }] };
    const id = await createProposal(db, input);
    const row = await base.aiProposal.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, "PENDING");
    assert.equal(row.version, 1);
    assert.equal(row.kind, "PLAN");
    assert.equal(row.createdBy, pm);
    assert.equal(row.flagged, true);
    assert.equal(row.sessionId, sessionId);
    assert.equal(row.projectId, projectId);
    assert.deepEqual(row.payload, { approach: input.approach, checkpoints: input.checkpoints, retrieved: input.retrieved });
    const epics = await base.proposalEpic.findMany({ where: { proposalId: id }, orderBy: { index: "asc" } });
    assert.deepEqual(epics.map((e) => e.index), [0, 1, 2]);
    epics.forEach((e, i) => {
      const src = input.epics[i];
      assert.equal(e.title, src.title);
      assert.equal(e.description, src.description);
      assert.equal(e.checkpointName, src.checkpointName);
      assert.equal(e.contentHash, hash(src.title, src.description, src.checkpointName));
      assert.equal(e.tasks, null);
      assert.equal(e.version, 1);
      assert.equal(e.expansionStatus, "PENDING");
    });
  });
});

test("E7 an unknown project is CONFLICT_STATE", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm = await f.user();
    const projectId = await f.project(pm);
    const sessionId = await f.aiSession(pm, projectId);
    const db = createDbClient(base);
    await assert.rejects(
      createProposal(db, baseInput("00000000-0000-4000-8000-000000000000", pm, sessionId)),
      (e: unknown) => e instanceof ProposalError && e.code === "CONFLICT_STATE",
    );
  });
});

test("E11 a failing epic insert leaves neither proposal nor epic rows", { skip: !integrationUrl }, async () => {
  await withIntegrationDb(async (base, f) => {
    const pm = await f.user();
    const projectId = await f.project(pm);
    const sessionId = await f.aiSession(pm, projectId);
    const db = createDbClient(base);
    const failing = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop !== "$transaction") return Reflect.get(target, prop, receiver);
        return (cb: (tx: object) => Promise<unknown>, ...rest: unknown[]) =>
          (target.$transaction as (...a: unknown[]) => Promise<unknown>)((tx: any) => cb(new Proxy(tx, {
            get(t, p, r) {
              if (p !== "proposalEpic") return Reflect.get(t, p, r);
              return new Proxy(t.proposalEpic, {
                get(mt, mp, mr) {
                  if (mp === "createMany") return async () => { throw new Error("injected"); };
                  return Reflect.get(mt, mp, mr);
                },
              });
            },
          })), ...rest);
      },
    }) as unknown as FilteredDbClient;
    await assert.rejects(createProposal(failing, baseInput(projectId, pm, sessionId)), /injected/);
    assert.equal(await base.aiProposal.count({ where: { projectId } }), 0);
    assert.equal(await base.proposalEpic.count({ where: { proposal: { projectId } } }), 0);
  });
});

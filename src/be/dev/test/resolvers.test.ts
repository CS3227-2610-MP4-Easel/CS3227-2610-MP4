import assert from "node:assert/strict";
import test from "node:test";
import { NotMember } from "@agile/contracts";
import { createDevResolvers } from "../src/store/resolvers.js";

const P = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";

const seen = { archived: [] as unknown[][], member: [] as unknown[][] };

function make(opts: { visible?: boolean; archivedMember?: boolean; member?: boolean; plainError?: boolean } = {}) {
  const db = { project: { findFirst: async () => (opts.visible === false ? null : { id: P }) } };
  seen.archived = []; seen.member = [];
  return createDevResolvers({
    db,
    lookupArchivedMembership: async (...a) => { seen.archived.push(a); return Boolean(opts.archivedMember); },
    requireMember: async (...a) => { seen.member.push(a); if (opts.plainError) throw new Error("boom"); if (opts.member === false) throw new NotMember(U, P); },
  });
}

test("E40 hidden project with archivedMember but no userId resolves null without a lookup", async () => {
  const r = make({ visible: false, archivedMember: true });
  assert.equal(await r.DEV_UPLOAD_CREATE!({ params: { id: P } }), null);
  assert.equal(seen.archived.length, 0);
});

test("E40 archived lookup and E36 requireMember receive (userId, projectId)", async () => {
  const r = make({ visible: false, archivedMember: true });
  await r.DEV_SUMMARY_CREATE!({ params: { id: P }, userId: U });
  assert.deepEqual(seen.archived, [[U, P]]);
  const m = make();
  await m.DEV_STANDUP_MINE_READ!({ params: { id: P }, userId: U });
  assert.deepEqual(seen.member, [[U, P]]);
});

test("E36 requireMember throwing a plain Error resolves null", async () => {
  assert.equal(await make({ plainError: true }).DEV_STANDUP_MINE_READ!({ params: { id: P }, userId: U }), null);
});

test("E40 visible project resolves ACTIVE for operations 49-51", async () => {
  const r = make();
  for (const op of ["DEV_UPLOAD_CREATE", "DEV_SUMMARY_CREATE", "DEV_STANDUP_CREATE", "LEAD_STANDUP_LIST"]) {
    assert.deepEqual(await r[op]!({ params: { id: P }, userId: U }), { kind: "PROJECT", projectId: P, state: "ACTIVE" });
  }
});

test("E40 archived project resolves ARCHIVED for 49-51 and null for 52 and 55", async () => {
  const r = make({ visible: false, archivedMember: true, member: false });
  for (const op of ["DEV_UPLOAD_CREATE", "DEV_SUMMARY_CREATE", "DEV_STANDUP_CREATE"]) {
    assert.deepEqual(await r[op]!({ params: { id: P }, userId: U }), { kind: "PROJECT", projectId: P, state: "ARCHIVED" });
  }
  assert.equal(await r.LEAD_STANDUP_LIST!({ params: { id: P }, userId: U }), null);
  assert.equal(await r.DEV_STANDUP_MINE_READ!({ params: { id: P }, userId: U }), null);
});

test("E40 hidden project without archived membership resolves null", async () => {
  const r = make({ visible: false });
  assert.equal(await r.DEV_UPLOAD_CREATE!({ params: { id: P }, userId: U }), null);
  assert.equal(await r.DEV_UPLOAD_CREATE!({ params: { id: P } }), null);
});

test("E36 removed developer resolves null for DEV_STANDUP_MINE_READ", async () => {
  assert.equal(await make({ member: false }).DEV_STANDUP_MINE_READ!({ params: { id: P }, userId: U }), null);
});

test("DEV_STANDUP_MINE_READ member resolves the STANDUP owned by the caller", async () => {
  assert.deepEqual(await make().DEV_STANDUP_MINE_READ!({ params: { id: P }, userId: U }), { kind: "STANDUP", projectId: P, ownerId: U, state: "ACTIVE" });
  assert.equal(await make().DEV_STANDUP_MINE_READ!({ params: { id: P } }), null);
});

test("non-UUID project id resolves null everywhere", async () => {
  const r = make();
  for (const op of Object.keys(r)) assert.equal(await r[op]!({ params: { id: "nope" }, userId: U }), null);
});

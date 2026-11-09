import assert from "node:assert/strict";
import test from "node:test";
import { NotMember } from "@agile/contracts";
import { createDevResolvers } from "../src/store/resolvers.js";

const P = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";

function make(opts: { visible?: boolean; archivedMember?: boolean; member?: boolean } = {}) {
  const db = { project: { findFirst: async () => (opts.visible === false ? null : { id: P }) } };
  return createDevResolvers({ db, lookupArchivedMembership: async () => Boolean(opts.archivedMember), requireMember: async () => { if (opts.member === false) throw new NotMember(U, P); } });
}

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

import assert from "node:assert/strict";
import { test } from "node:test";
import { createAppDependencies, LOCAL_DEV_PM_TOKEN } from "../src/deps.js";

const real = async (header: string | undefined) => {
  if (header !== "Bearer real") throw new Error("UNAUTHENTICATED");
  return { firebaseUid: "real", tokenClaims: {} };
};
const base = { resolvePrincipal: real, lookupRegisteredUser: async () => null };

test("the dev PM token resolves to the demo PM on the local tier only", async () => {
  const local = createAppDependencies({ ...base, settings: { tier: "local" } });
  assert.deepEqual(await local.resolvePrincipal(LOCAL_DEV_PM_TOKEN), { firebaseUid: "w13-demo-pm", tokenClaims: {} });
  assert.equal((await local.resolvePrincipal("Bearer real")).firebaseUid, "real");
  await assert.rejects(() => local.resolvePrincipal("Bearer dev-lead"), /UNAUTHENTICATED/);
});

test("every other tier, and a missing tier, refuses the dev PM token", async () => {
  for (const tier of ["dev", "preview", "prod", "test"]) {
    await assert.rejects(() => createAppDependencies({ ...base, settings: { tier } }).resolvePrincipal(LOCAL_DEV_PM_TOKEN), /UNAUTHENTICATED/, tier);
  }
  await assert.rejects(() => createAppDependencies(base).resolvePrincipal(LOCAL_DEV_PM_TOKEN), /UNAUTHENTICATED/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("W7c E35 API route declares maxDuration 60", async () => {
  const route = await readFile(new URL("../../../fe/app/api/[[...route]]/route.ts", import.meta.url), "utf8");
  assert.match(route, /export const maxDuration = 60;/);
});

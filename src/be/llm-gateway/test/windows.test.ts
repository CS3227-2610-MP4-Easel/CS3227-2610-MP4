import assert from "node:assert/strict";
import { test } from "node:test";
import type { Hit } from "@agile/auth";
import { checkWindows } from "../src/index.js";

const recordingHit = (refuse: Record<string, number> = {}) => {
  const calls: Array<[string, number, number]> = [];
  const hit: Hit = async (key, windowSeconds, limit) => {
    calls.push([key, windowSeconds, limit]);
    return key in refuse ? { allowed: false, retryAfterSeconds: refuse[key] } : { allowed: true, retryAfterSeconds: 0 };
  };
  return { hit, calls };
};

test("E8 E9 windows are hit in order with the configured limits", async () => {
  const { hit, calls } = recordingHit();
  assert.deepEqual(await checkWindows(hit, "u1"), { ok: true });
  assert.deepEqual(calls, [["user:u1:min", 60, 6], ["user:u1:day", 86_400, 200], ["global:min", 60, 25], ["global:day", 86_400, 2_000]]);
});

test("E8 a per-user refusal stops before the global keys", async () => {
  const { hit, calls } = recordingHit({ "user:u1:min": 37 });
  assert.deepEqual(await checkWindows(hit, "u1"), { ok: false, retryAfterSeconds: 37 });
  assert.deepEqual(calls.map(([key]) => key), ["user:u1:min"]);
});

test("E9 a global refusal leaves the user keys counted and skips global:day", async () => {
  const { hit, calls } = recordingHit({ "global:min": 12 });
  assert.deepEqual(await checkWindows(hit, "u1"), { ok: false, retryAfterSeconds: 12 });
  assert.deepEqual(calls.map(([key]) => key), ["user:u1:min", "user:u1:day", "global:min"]);
});

test("E11 a hit failure propagates", async () => {
  const hit: Hit = async () => { throw new Error("db down"); };
  await assert.rejects(checkWindows(hit, "u1"), { message: "db down" });
});

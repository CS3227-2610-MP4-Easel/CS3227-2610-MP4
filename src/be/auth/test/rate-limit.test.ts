import assert from "node:assert/strict";
import { test } from "node:test";
import { clientIpKey, createHit, type RateCounter } from "../src/index.js";

const SECRET = "s".repeat(32);

test("E44 bad hit arguments throw RangeError without a database call", async () => {
  let calls = 0;
  const hit = createHit(async () => { calls += 1; return { count: 1, remainingSeconds: 60 }; });
  const bad: Array<[string, number, number]> = [
    ["", 60, 20], ["k".repeat(201), 60, 20],
    ["k", 0, 20], ["k", -1, 20], ["k", 1.5, 20],
    ["k", 60, 0], ["k", 60, -1], ["k", 60, 1.5],
  ];
  for (const args of bad) await assert.rejects(() => hit(...args), RangeError);
  assert.equal(calls, 0);
  await hit("k".repeat(200), 60, 20);
  assert.equal(calls, 1);
});

test("hit admits up to limit and reports retry seconds", async () => {
  let next = { count: 20, remainingSeconds: 37 };
  const counter: RateCounter = async () => next;
  const hit = createHit(counter);
  assert.deepEqual(await hit("k", 60, 20), { allowed: true, retryAfterSeconds: 0 });
  next = { count: 21, remainingSeconds: 37 };
  assert.deepEqual(await hit("k", 60, 20), { allowed: false, retryAfterSeconds: 37 });
  next = { count: 22, remainingSeconds: 61 };
  assert.deepEqual(await hit("k", 60, 20), { allowed: false, retryAfterSeconds: 60 });
  next = { count: 22, remainingSeconds: 0 };
  assert.deepEqual(await hit("k", 60, 20), { allowed: false, retryAfterSeconds: 1 });
});

test("E37 IPv6 /64, mapped IPv4 and case share a bucket", () => {
  const key = (ip: string | null) => clientIpKey("register", ip, SECRET);
  assert.equal(key("2001:db8:1:2::1"), key("2001:db8:1:2:ffff:ffff:ffff:ffff"));
  assert.equal(key("2001:DB8:1:2::1"), key("2001:db8:1:2::abcd"));
  assert.equal(key("::ffff:1.2.3.4"), key("1.2.3.4"));
  assert.equal(key("::ffff:0102:0304"), key("1.2.3.4"));
  assert.notEqual(key("2001:db8:1:2::1"), key("2001:db8:1:3::1"));
  assert.notEqual(key("1.2.3.4"), key("1.2.3.5"));
});

test("client IP comes from the first trimmed value; invalid values share the unknown bucket", () => {
  const key = (ip: string | null) => clientIpKey("check-code", ip, SECRET);
  assert.equal(key(" 1.2.3.4 , 9.9.9.9"), key("1.2.3.4"));
  assert.equal(key(null), key(""));
  assert.equal(key("not-an-ip"), key(null));
  assert.notEqual(clientIpKey("check-code", "1.2.3.4", SECRET), clientIpKey("register", "1.2.3.4", SECRET));
});

test("N3 keys are ip: plus 64 hex and contain no IP text", () => {
  for (const ip of ["1.2.3.4", "2001:db8:1:2::1", null]) {
    const key = clientIpKey("register", ip, SECRET);
    assert.match(key, /^ip:[0-9a-f]{64}$/);
    if (ip) assert.ok(!key.includes(ip));
  }
});

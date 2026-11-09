import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyTooLarge, contentLengthTooLarge, readLimitedBody } from "../src/body-limit.js";

const streamed = (...parts: Uint8Array[]) => new Request("http://localhost/x", { method: "POST", duplex: "half", body: new ReadableStream({ start(controller) { for (const part of parts) controller.enqueue(part); controller.close(); } }) } as RequestInit);
const bytes = (n: number) => new Uint8Array(n).fill(97);

test("N1 a body of exactly maxBytes is accepted, maxBytes + 1 is rejected (streamed, no Content-Length)", async () => {
  const ok = streamed(bytes(8), bytes(8));
  assert.equal(ok.headers.get("content-length"), null);
  assert.deepEqual(await readLimitedBody(ok, 16), { tooLarge: false, text: "a".repeat(16) });
  assert.deepEqual(await readLimitedBody(streamed(bytes(8), bytes(9)), 16), { tooLarge: true });
});

test("N1 a body of maxBytes + 1 with Content-Length is rejected, as is exactly maxBytes accepted", async () => {
  const post = (text: string) => new Request("http://localhost/x", { method: "POST", body: text });
  assert.deepEqual(await readLimitedBody(post("a".repeat(17)), 16), { tooLarge: true });
  assert.deepEqual(await readLimitedBody(post("a".repeat(16)), 16), { tooLarge: false, text: "a".repeat(16) });
});

test("N1 a Content-Length over the limit is rejected without reading the body", async () => {
  const request = new Request("http://localhost/x", { method: "POST", headers: { "content-length": "17" }, body: "x" });
  assert.equal(contentLengthTooLarge(request, 16), true);
  assert.equal(request.bodyUsed, false);
  assert.equal(contentLengthTooLarge(new Request("http://localhost/x", { headers: { "content-length": "abc" } }), 16), false);
});

test("N1 a missing body reads as empty text", async () => {
  assert.deepEqual(await readLimitedBody(new Request("http://localhost/x"), 16), { tooLarge: false, text: "" });
});

test("N1 multi-byte UTF-8 round-trips and is counted in bytes", async () => {
  const text = "héllo✓"; // 9 bytes
  assert.deepEqual(await readLimitedBody(new Request("http://localhost/x", { method: "POST", body: text }), 16), { tooLarge: false, text });
  assert.equal((await readLimitedBody(new Request("http://localhost/x", { method: "POST", body: "✓".repeat(6) }), 16)).tooLarge, true);
});

test("N1 bodyTooLarge leaves the original body readable", async () => {
  const request = new Request("http://localhost/x", { method: "POST", body: "a".repeat(10) });
  assert.equal(await bodyTooLarge(request, 16), false);
  assert.equal(await request.text(), "a".repeat(10));
});

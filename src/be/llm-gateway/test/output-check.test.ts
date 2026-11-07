import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { checkOutput, type CheckedOutput, type OutputContext } from "../src/output-check.js";

const U = (...codePoints: number[]) => String.fromCodePoint(...codePoints);
const B = "0123456789abcdef";
const ctx: OutputContext = { boundary: B, secrets: [] };
const text = (maxChars = 2000) => ({ kind: "text" as const, maxChars });
const json = (schema: z.ZodType = z.unknown()) => ({ kind: "json" as const, schema });
const reasonOf = (result: CheckedOutput) => (result.ok ? "ok" : result.reason);
const asText = (answer: string, context: OutputContext = ctx) => reasonOf(checkOutput(answer, text(), context));
const asJson = (answer: string, schema?: z.ZodType) => reasonOf(checkOutput(answer, json(schema), ctx));
/** A JSON escape built without writing a backslash-u sequence in this file. */
const esc = (hex: string) => "\\" + "u" + hex;

function fastest(run: () => unknown): number {
  run();
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

test("E33 F6 the exact refusal object refuses in either kind", () => {
  assert.deepEqual(checkOutput('{"refusal":true}', json(), ctx), { ok: false, status: "REFUSED", reason: "REFUSAL" });
  assert.deepEqual(checkOutput(' {"refusal": true} ', text(), ctx), { ok: false, status: "REFUSED", reason: "REFUSAL" });
});

test("E44 F6 only the exact form refuses", () => {
  const strict = z.object({ x: z.number() }).strict();
  const answers = ['{"refusal":true,"x":1}', '{"refusal":false}', '{"refusal":"true"}', '[{"refusal":true}]', '{"refusal":true} trailing'];
  for (const answer of answers) assert.deepEqual(checkOutput(answer, text(), ctx), { ok: true, value: answer });
  assert.deepEqual(answers.map((a) => asJson(a, strict)), ["SCHEMA", "SCHEMA", "SCHEMA", "SCHEMA", "PARSE"]);
});

test("E45 F6 N1 parse, schema and shape failures; deep or wide output never throws", () => {
  assert.equal(asJson("{nope"), "PARSE");
  assert.equal(asJson('{"x":"a"}', z.object({ x: z.number() })), "SCHEMA");
  assert.equal(asJson("[".repeat(100) + "]".repeat(100)), "SHAPE");
  assert.equal(asJson(JSON.stringify(Array.from({ length: 10_001 }, () => "a"))), "SHAPE");
  const deep = checkOutput("[".repeat(100_000) + "]".repeat(100_000), json(), ctx);
  assert.equal(deep.ok, false);
  assert.ok(!deep.ok && deep.status === "SCHEMA_FAIL" && (deep.reason === "SHAPE" || deep.reason === "PARSE"));
});

test("E46 F6 links in a text answer", () => {
  for (const answer of ["https://x.io", "HTTP://x", "www.x.com", "javascript:alert(1)", "mailto:a", "java\nscript:x", "//evil.io/a", "1.2.3.4/x", "data:text/html,x", "file:///x"]) {
    assert.equal(asText(answer), "LINK", answer);
  }
});

test("E47 F6 a link split across fields is caught by the joined check", () => {
  assert.equal(asJson('["java", "script:alert(1)"]'), "LINK");
  assert.equal(asJson('["www", ".evil.io"]'), "LINK");
  assert.equal(asJson('["mail", "to:person@example.com"]'), "LINK");
  assert.equal(asJson('["10.0", ".0.1"]'), "LINK");
});

test("F6 the joined check also covers HTML, Markdown, the boundary and secrets", () => {
  assert.equal(asJson('["<", "img src=x>"]'), "HTML");
  assert.equal(asJson('["[a]", "(b)"]'), "MARKDOWN_LINK");
  assert.equal(asJson(`["${B.slice(0, 8)}", "${B.slice(8)}"]`), "BOUNDARY");
  assert.equal(asJson('["sk-aaaaaaaa", "aaaaaaaa"]'), "SECRET");
  assert.equal(asJson('["ab", "cd"]'), "ok");
});

test("F6 M3 alone, and a ZWJ outside an emoji sequence", () => {
  assert.equal(asText("![alt"), "MARKDOWN_LINK");
  assert.equal(asText(`a${U(0x200d)}b`), "FORBIDDEN_CHAR");
});

test("E48 F6 HTML: escaped, comment, fullwidth, entity, unterminated, closing tag", () => {
  assert.equal(asText("<p onclick=alert(1)>"), "HTML");
  assert.equal(asJson('["' + esc("003c") + "img src=x" + esc("003e") + '"]'), "HTML");
  for (const answer of ["<!-- x -->", `${U(0xff1c)}img${U(0xff1e)}`, "&#60;img", "<img src=x onerror=", "</div>", "&lt;script&gt;"]) {
    assert.equal(asText(answer), "HTML", answer);
  }
});

test("E49 F6 Markdown links and images at any depth", () => {
  assert.equal(asJson('{"a":[["![a](b)"]]}'), "MARKDOWN_LINK");
  assert.equal(asJson('{"a":[["[a](b)"]]}'), "MARKDOWN_LINK");
  assert.equal(asText("[x][1]"), "MARKDOWN_LINK");
  assert.equal(asText("[" + "a".repeat(300) + "](u)"), "MARKDOWN_LINK");
  assert.equal(asText("[1]: //e"), "LINK", "step 5 runs before step 7");
});

test("E50 F6 own keys are checked, including __proto__", () => {
  assert.equal(asJson('{"www.x": 1}'), "LINK");
  assert.equal(asJson('{"__proto__": "www.x"}'), "LINK");
});

test("E51 F6 forbidden characters in output; a raw control character is a parse failure", () => {
  for (const escape of [esc("0007"), esc("200b"), esc("202e"), esc("feff"), esc("fe0e"), esc("db40") + esc("dc01")]) {
    assert.equal(asJson(`["a${escape}"]`), "FORBIDDEN_CHAR", escape);
  }
  assert.equal(asJson('["a' + U(0x07) + '"]'), "PARSE");
});

test("E52 F6 the first failure returns", () => {
  assert.equal(asText('<a href="https://x">'), "LINK");
  assert.equal(asText(`${U(0x200b)} www.x`), "FORBIDDEN_CHAR");
  assert.equal(asText(`${B} sk-${"a".repeat(20)}`), "BOUNDARY");
  assert.equal(reasonOf(checkOutput("www.x " + "a".repeat(50), text(10), ctx)), "LINK");
  assert.equal(asJson('{"a":"www.x"'), "PARSE");
});

test("F6 strings are checked in document order", () => {
  assert.equal(asJson('{"a":"www.x","b":"<img "}'), "LINK");
  assert.equal(asJson('{"a":"<img ","b":"www.x"}'), "HTML");
});

test("E53 F6 boundary and secret leaks; an empty secret matches nothing", () => {
  const fullwidth = U(...[...B].map((c) => (c <= "9" ? 0xff10 + Number(c) : 0xff41 + c.charCodeAt(0) - 97)));
  assert.equal(asText(`x ${B.toUpperCase()} y`), "BOUNDARY");
  assert.equal(asText(`x ${fullwidth} y`), "BOUNDARY");
  assert.equal(asText(`<data-${B}>`), "BOUNDARY");
  // Built at runtime, so the source holds no secret-shaped literal for the CI secret scan to flag.
  const fakeSecret = ["value", "under", "test", "123"].join("-");
  assert.equal(asText(`the key is ${fakeSecret}`, { boundary: B, secrets: [fakeSecret] }), "SECRET");
  assert.equal(asText(`sk-${"a".repeat(15)}`), "ok");
  assert.equal(asText(`sk-${"a".repeat(16)}`), "SECRET");
  assert.equal(asText(`disk-${"a".repeat(20)}`), "ok");
  assert.equal(asText("a clean answer", { boundary: B, secrets: [""] }), "ok");
  assert.equal(asText("too short", { boundary: B, secrets: ["short"] }), "ok", "secrets under 8 characters are ignored");
  const fullwidthKey = U(...[..."KEY12345678"].map((c) => c.charCodeAt(0) + 0xfee0));
  assert.equal(asText("echo KEY12345678", { boundary: B, secrets: [fullwidthKey] }), "SECRET", "secrets are compared after NFKC");
});

test("E54 F6 length counts the original text's code points", () => {
  assert.equal(reasonOf(checkOutput("", text(10), ctx)), "LENGTH");
  const exact = `${U(0x2026)}${U(0x1f600)}${"a".repeat(8)}`;
  assert.deepEqual(checkOutput(exact, text(10), ctx), { ok: true, value: exact });
  assert.equal(reasonOf(checkOutput(exact + "a", text(10), ctx)), "LENGTH");
});

test("E55 F6 ordinary text, generics, headings and emoji pass", () => {
  const benign = [
    "a < b and c > d", "x<y and z>w", "Promise<void>", "List<String>", "Q&A; R&D;", "3 [items] (done)", "[PROJ-12]: fixed login",
    "File: login.ts", "data: 5 items", "Migrate user data:\n1. export", "metadata: x", "see section 3: done", "v1.2.3", "line\r\nnext\tcol",
    `${U(0x26a0, 0xfe0f)} risk`, `${U(0x1f468, 0x200d, 0x1f4bb)} pairing`,
  ];
  for (const answer of benign) assert.equal(asText(answer), "ok", answer);
  assert.deepEqual(checkOutput('{"x":1}', json(z.object({ x: z.number() })), ctx), { ok: true, value: { x: 1 } });
});

test("schema transformations cannot introduce unsafe output", () => {
  const decode = z.string().transform((value) => decodeURIComponent(value));
  assert.equal(asJson('"%3Cscript%3E"', decode), "HTML");
  assert.deepEqual(checkOutput('"hello%20world"', json(decode), ctx), { ok: true, value: "hello world" });
});

test("E56 F6 documented false positives", () => {
  assert.equal(asText("release 10.0.0.1"), "LINK");
  assert.equal(asText("if a<a href"), "HTML");
});

test("E35 N2 adversarial output stays within 500 ms", () => {
  for (const unit of ["<a", "[x](", "[[[", "www", "sk-", "&#"]) {
    const answer = unit.repeat(Math.ceil(100_000 / unit.length));
    const ms = fastest(() => checkOutput(answer, text(200_000), ctx));
    assert.ok(ms < 500, `${unit} took ${ms.toFixed(0)} ms`);
  }
});

test("E37 N3 repeated calls give equal results (no regex state)", () => {
  for (const positive of ["https://x.io", "<img src=x>", "[a](b)", `sk-${"a".repeat(20)}`, "release 10.0.0.1"]) {
    const first = asText(positive);
    for (let i = 0; i < 3; i++) {
      assert.equal(asText(positive), first);
      assert.equal(asText("plain words"), "ok");
    }
  }
});

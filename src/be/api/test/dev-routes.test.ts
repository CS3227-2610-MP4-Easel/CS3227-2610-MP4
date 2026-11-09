import assert from "node:assert/strict";
import { test } from "node:test";
import { resetContextRegistries } from "@agile/ai-context/testing";
import { createCore } from "@agile/core";
import { DevError, createDevRuntime } from "@agile/dev";
import { createApiApp } from "../src/app.js";
import { createCoreComposition } from "../src/core-composition.js";
import { withDevComposition } from "../src/dev-composition.js";
import { createAppDependencies } from "../src/deps.js";
import { createDevRoutes, type DevRouteServices } from "../src/routes/index.js";

const projectId = "33333333-3333-4333-8333-333333333333";
const users: Record<string, { userId: string; role: "PM" | "DEV_LEAD" | "DEVELOPER" }> = {
  dev: { userId: "11111111-1111-4111-8111-111111111111", role: "DEVELOPER" },
  lead: { userId: "22222222-2222-4222-8222-222222222222", role: "DEV_LEAD" },
  pm: { userId: "44444444-4444-4444-8444-444444444444", role: "PM" },
  stranger: { userId: "55555555-5555-4555-8555-555555555555", role: "DEV_LEAD" },
};
const SECRET_TITLE = "FIXTURE-SECRET-TITLE";
const SECRET_LINE = "FIXTURE-SECRET-STANDUP-LINE";
const ids = (n: number) => Array.from({ length: n }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`);

function build(overrides: Partial<DevRouteServices> = {}) {
  resetContextRegistries();
  const calls: Record<string, unknown[][]> = { upload: [], summaries: [], standup: [], mine: [], leadList: [] };
  const record = (name: string, args: unknown[]) => { calls[name].push(args); };
  const services: DevRouteServices = {
    now: () => new Date("2026-11-10T04:00:00Z"),
    upload: async (...args) => { record("upload", args); return { accepted: args[2].length, duplicates: 0, rejected: 0 }; },
    summaries: async (...args) => { record("summaries", args); return { summaries: [], failed: [] }; },
    standup: async (...args) => { record("standup", args); return { ok: true }; },
    mine: async (...args) => { record("mine", args); throw new Error("NOT_FOUND"); },
    leadList: async (...args) => { record("leadList", args); const q = args[2]; const rows = [1, 2, 3].slice(q.page * q.size, (q.page + 1) * q.size); return { items: rows, page: q.page, size: q.size, total: 3 }; },
    ...overrides,
  };
  const db = {
    project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }) },
    projectMember: { findFirst: async ({ where }: { where: { userId: string } }) => (where.userId === users.stranger.userId ? null : { userId: where.userId }), findMany: async () => [] },
    checkpoint: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, task: { findMany: async () => [] },
  };
  const runtime = {
    db,
    resolvePrincipal: async (header: string | undefined) => {
      const name = header?.startsWith("Bearer ") ? header.slice(7) : "";
      if (users[name]) return { firebaseUid: name, tokenClaims: {} };
      throw new Error("UNAUTHENTICATED");
    },
    lookupRegisteredUser: async (uid: string) => ({ firebaseUid: uid, ...users[uid] }),
    lookupUserByEmail: async () => null,
    lookupUserRole: async () => null,
    lookupArchivedMembership: async () => false,
  };
  const core = createCore({ db: db as never, archivedMembership: runtime.lookupArchivedMembership });
  const real = createDevRuntime({ db: db as never, requireMember: core.requireMember, members: async () => [], lookupArchivedMembership: runtime.lookupArchivedMembership });
  const composition = withDevComposition(createCoreComposition(runtime as never), { resolvers: real.resolvers, routes: createDevRoutes(services) });
  return { api: createApiApp(createAppDependencies(runtime as never, composition), composition.routes), calls };
}

const base = `http://localhost/api/dev/projects/${projectId}`;
// "/standups" with a GET and no "mine" is the Dev Lead list at /api/lead; "/activity-items" is the upload endpoint.
const urlFor = (method: string, path: string) => path.startsWith("/standups") && method === "GET" && !path.startsWith("/standups/mine") ? `http://localhost/api/lead/projects/${projectId}${path}` : `${base}${path === "/activity-items" ? "/uploads" : path}`;
const send = (api: ReturnType<typeof build>["api"], who: string | null, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) =>
  api.request(urlFor(method, path), { method, headers: { ...(who ? { authorization: `Bearer ${who}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), ...extra }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
const code = async (response: Response) => (await response.json() as { error: { code: string; details?: { field: string }[] } }).error;
const upload = (size: number) => `{"items":["${"x".repeat(size - 14)}"]}`;

test("E1 a body over 1,048,576 bytes is 413 with and without Content-Length; the limit itself is accepted", async () => {
  const { api, calls } = build();
  const over = upload(1_048_577);
  assert.equal(Buffer.byteLength(over), 1_048_577);
  const withLength = await send(api, "dev", "POST", "/activity-items", over, { "content-length": String(Buffer.byteLength(over)) });
  assert.equal(withLength.status, 413);
  assert.equal((await code(withLength)).code, "PAYLOAD_TOO_LARGE");
  const without = await send(api, "dev", "POST", "/activity-items", over);
  assert.equal(without.status, 413);
  assert.equal(calls.upload.length, 0, "nothing stored");
  const exact = upload(1_048_576);
  assert.equal(Buffer.byteLength(exact), 1_048_576);
  assert.equal((await send(api, "dev", "POST", "/activity-items", exact)).status, 200);
});

test("E2 101 items is 422 with an items detail; 100 items is accepted", async () => {
  const { api } = build();
  const bad = await send(api, "dev", "POST", "/activity-items", { items: Array.from({ length: 101 }, () => ({})) });
  assert.equal(bad.status, 422);
  const error = await code(bad);
  assert.equal(error.code, "VALIDATION_FAILED");
  assert.equal(error.details?.[0].field, "items");
  assert.equal((await send(api, "dev", "POST", "/activity-items", { items: Array.from({ length: 100 }, () => ({})) })).status, 200);
});

test("E3 an unknown top-level field is 422", async () => {
  const response = await send(build().api, "dev", "POST", "/activity-items", { items: [], author: "x" });
  assert.equal(response.status, 422);
  assert.equal((await code(response)).code, "VALIDATION_FAILED");
});

test("E11 an empty upload is 200", async () => {
  const response = await send(build().api, "dev", "POST", "/activity-items", { items: [] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accepted: 0, duplicates: 0, rejected: 0 });
});

test("E14 itemIds with 11 ids, a repeat, a case-only repeat, or none are 422", async () => {
  const { api, calls } = build();
  const [a] = ids(1);
  for (const itemIds of [ids(11), [a, a], [a, a.toUpperCase()], []]) {
    const response = await send(api, "dev", "POST", "/summaries", { itemIds });
    assert.equal(response.status, 422, JSON.stringify(itemIds.length));
    assert.equal((await code(response)).code, "VALIDATION_FAILED");
  }
  assert.equal(calls.summaries.length, 0);
});

test("E14 one upper-case item id is accepted and reaches the flow in lower case", async () => {
  const { api, calls } = build();
  const [a] = ids(1);
  assert.equal((await send(api, "dev", "POST", "/summaries", { itemIds: [a.toUpperCase()] })).status, 200);
  assert.deepEqual(calls.summaries[0][2], [a]);
});

test("E25 a standup date outside the accepted window is 422; a null date reaches the flow as undefined", async () => {
  const { api, calls } = build({ standup: async (_c, _p, date) => { if (date) throw new DevError("VALIDATION_FAILED", 422); return { ok: true }; } });
  for (const date of ["2026-11-09", "2026-11-12"]) {
    const response = await send(api, "dev", "POST", "/standups", { date });
    assert.equal(response.status, 422);
    assert.equal((await code(response)).code, "VALIDATION_FAILED");
  }
  assert.equal((await send(api, "dev", "POST", "/standups", { date: null })).status, 200);
  assert.equal((await send(api, "dev", "POST", "/standups", {})).status, 200);
  void calls;
});

test("E35 the caller's standup for a date with none is 404", async () => {
  const { api, calls } = build();
  const response = await send(api, "dev", "GET", "/standups/mine?date=2026-11-10");
  assert.equal(response.status, 404);
  assert.equal((await code(response)).code, "NOT_FOUND");
  assert.deepEqual(calls.mine[0].slice(2), ["2026-11-10"]);
  await send(api, "dev", "GET", "/standups/mine");
  assert.equal(calls.mine[1][2], "2026-11-10", "defaults to today in Singapore");
});

test("E39 a page past the end is empty and keeps the total", async () => {
  const response = await send(build().api, "lead", "GET", "/standups?page=1&size=5");
  assert.equal(response.status, 200);
  const body = await response.json() as { items: unknown[]; total: number };
  assert.deepEqual(body.items, []);
  assert.equal(body.total, 3);
});

test("E41 wrong roles get 403 FORBIDDEN_ROLE", async () => {
  const { api } = build();
  const cases: [string, string, string, unknown?][] = [
    ["pm", "POST", "/activity-items", { items: [] }], ["lead", "POST", "/activity-items", { items: [] }],
    ["pm", "POST", "/summaries", { itemIds: ids(1) }], ["lead", "POST", "/summaries", { itemIds: ids(1) }],
    ["pm", "POST", "/standups", {}], ["lead", "POST", "/standups", {}],
    ["pm", "GET", "/standups/mine"], ["lead", "GET", "/standups/mine"],
    ["dev", "GET", "/standups"], ["pm", "GET", "/standups"],
  ];
  for (const [who, method, path, body] of cases) {
    const response = await send(api, who, method, path, body);
    assert.equal(response.status, 403, `${who} ${method} ${path}`);
    assert.equal((await code(response)).code, "FORBIDDEN_ROLE");
  }
});

test("E57 an impossible or malformed date is 422 on 52", async () => {
  const { api } = build();
  for (const date of ["2026-02-30", "2026-1-5"]) assert.equal((await send(api, "dev", "GET", `/standups/mine?date=${date}`)).status, 422);
});

test("E58 bad paging or developerId is 422 on 55", async () => {
  const { api } = build();
  for (const query of ["size=0", "size=101", "page=-1", "developerId=x"]) {
    const response = await send(api, "lead", "GET", `/standups?${query}`);
    assert.equal(response.status, 422, query);
    assert.equal((await code(response)).code, "VALIDATION_FAILED");
  }
});

test("E59 a Dev Lead who is not a member gets 404 on 55", async () => {
  const response = await send(build().api, "stranger", "GET", "/standups");
  assert.equal(response.status, 404);
});

test("E69 no token with a 1 MB body and no Content-Length is 401 before the body is read", async () => {
  const { api, calls } = build();
  let pulled = 0;
  const chunk = new Uint8Array(65_536).fill(120);
  const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled++; controller.enqueue(chunk); if (pulled >= 16) controller.close(); } });
  const response = await api.request(`${base}/uploads`, { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" } as RequestInit);
  assert.equal(response.status, 401);
  assert.ok(pulled <= 2, "the stream was not drained");
  assert.equal(calls.upload.length, 0);
});

test("a DevError maps to its envelope with Retry-After and no service text", async () => {
  const { api } = build({ standup: async () => { throw new DevError("RATE_LIMITED", 429, 30, [{ field: "reason", message: "LOCAL_LIMIT" }]); } });
  const response = await send(api, "dev", "POST", "/standups", {});
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  const error = await code(response);
  assert.equal(error.code, "RATE_LIMITED");
  assert.deepEqual(error.details, [{ field: "reason", message: "LOCAL_LIMIT" }]);
});

test("E45 logs of every dev route, including write failures, carry no item or standup text", async () => {
  const logged: string[] = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  for (const name of Object.keys(originals) as (keyof typeof originals)[]) console[name] = (...args: unknown[]) => { logged.push(JSON.stringify(args, (_k, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v))); };
  try {
    const failing = new Error(`write failed ${SECRET_TITLE} ${SECRET_LINE}`);
    const { api } = build({
      upload: async () => { throw failing; }, standup: async () => { throw failing; },
      summaries: async () => ({ summaries: [{ oneLiner: SECRET_LINE }], failed: [] }),
    });
    await send(api, "dev", "POST", "/activity-items", { items: [{ title: SECRET_TITLE, body: SECRET_LINE }] });
    await send(api, "dev", "POST", "/summaries", { itemIds: ids(1) });
    await send(api, "dev", "POST", "/standups", {});
    await send(api, "dev", "GET", "/standups/mine");
    await send(api, "lead", "GET", "/standups");
  } finally { Object.assign(console, originals); }
  assert.ok(logged.length > 0, "the failures were logged");
  for (const line of logged) { assert.ok(!line.includes(SECRET_TITLE), line); assert.ok(!line.includes(SECRET_LINE), line); }
});

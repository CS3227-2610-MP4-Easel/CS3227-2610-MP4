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
const FIXED_NOW = new Date("2026-11-10T04:00:00Z");
const ids = (n: number) => Array.from({ length: n }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`);
type BuildOptions = { now?: Date; real?: boolean; archived?: boolean };

function build(overrides: Partial<DevRouteServices> = {}, options: BuildOptions = {}) {
  resetContextRegistries();
  const now = options.now ?? FIXED_NOW;
  const calls: Record<string, unknown[][]> = { upload: [], summaries: [], standup: [], mine: [], leadList: [] };
  const record = (name: string, args: unknown[]) => { calls[name].push(args); };
  const services: DevRouteServices = {
    now: () => now,
    upload: async (...args) => { record("upload", args); return { received: args[2].length }; },
    summaries: async (...args) => { record("summaries", args); return { summaries: [], failed: [] }; },
    standup: async (...args) => { record("standup", args); return { ok: true }; },
    mine: async (...args) => { record("mine", args); throw new Error("NOT_FOUND"); },
    leadList: async (...args) => { record("leadList", args); const q = args[2]; const rows = [1, 2, 3].slice(q.page * q.size, (q.page + 1) * q.size); return { items: rows, page: q.page, size: q.size, total: 3 }; },
    ...overrides,
  };
  const tx = {
    project: { findFirst: async () => ({ id: projectId, status: "ACTIVE" }), update: async () => ({}) },
    activityItem: { findMany: async () => [], upsert: async () => ({ id: "66666666-6666-4666-8666-666666666666" }) },
    itemSummary: { findMany: async () => [], findFirst: async () => null, count: async () => 0 },
    standup: { upsert: async ({ create }: { create: Record<string, unknown> }) => ({ id: "77777777-7777-4777-8777-777777777777", outcome: null, feedback: null, createdAt: now, updatedAt: now, ...create }), findFirst: async () => null, findMany: async () => [], count: async () => 0 },
  };
  const db = {
    ...tx,
    project: { ...tx.project, findFirst: async () => (options.archived ? null : { id: projectId, status: "ACTIVE" }) },
    projectMember: { findFirst: async ({ where }: { where: { userId: string } }) => (where.userId === users.stranger.userId ? null : { userId: where.userId }), findMany: async () => [] },
    checkpoint: { findMany: async () => [] }, taskEvent: { findMany: async () => [] }, task: { findMany: async () => [] },
    $transaction: async (work: (t: typeof tx) => Promise<unknown>) => work(tx),
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
    lookupArchivedMembership: async () => Boolean(options.archived),
  };
  const core = createCore({ db: db as never, archivedMembership: runtime.lookupArchivedMembership });
  const sessionId = "88888888-8888-4888-8888-888888888888";
  const real = createDevRuntime({
    db: db as never, requireMember: core.requireMember, members: async () => [], lookupArchivedMembership: runtime.lookupArchivedMembership, now: () => now,
    overrides: { gateway: { run: async () => { throw new Error("no model call expected"); } } as never, sessions: { open: async () => sessionId, openOrReuse: async () => sessionId, regenerate: async () => {} } as never, ai: { assembleWith: async () => ({ sections: [], provenance: [] }) }, recordCacheHit: async () => {} },
  });
  const composition = withDevComposition(createCoreComposition(runtime as never), { resolvers: real.resolvers, routes: createDevRoutes(options.real ? real : services) });
  return { api: createApiApp(createAppDependencies(runtime as never, composition), composition.routes), calls };
}

type Api = ReturnType<typeof build>["api"];
const base = `http://localhost/api/dev/projects/${projectId}`;
// "/standups" with a GET and no "mine" is the Dev Lead list at /api/lead; "/activity-items" is the upload endpoint.
const urlFor = (method: string, path: string, id = projectId) => path.startsWith("/standups") && method === "GET" && !path.startsWith("/standups/mine") ? `http://localhost/api/lead/projects/${id}${path}` : `http://localhost/api/dev/projects/${id}${path === "/activity-items" ? "/uploads" : path}`;
const send = (api: Api, who: string | null, method: string, path: string, body?: unknown, extra: Record<string, string> = {}, id = projectId) =>
  api.request(urlFor(method, path, id), { method, headers: { ...(who ? { authorization: `Bearer ${who}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }), ...extra }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
const code = async (response: Response) => (await response.json() as { error: { code: string; message: string; details?: { field: string; message: string }[] } }).error;
const upload = (size: number) => `{"items":["${"x".repeat(size - 14)}"]}`;
const lengthOf = (body: string) => ({ "content-length": String(Buffer.byteLength(body)) });

test("E1 a body over 1,048,576 bytes is 413 with and without Content-Length; the limit itself is accepted", async () => {
  const { api, calls } = build();
  const over = upload(1_048_577);
  assert.equal(Buffer.byteLength(over), 1_048_577);
  const withLength = await send(api, "dev", "POST", "/activity-items", over, lengthOf(over));
  assert.equal(withLength.status, 413);
  assert.equal((await code(withLength)).code, "PAYLOAD_TOO_LARGE");
  const without = await send(api, "dev", "POST", "/activity-items", over);
  assert.equal(without.status, 413);
  assert.equal(calls.upload.length, 0, "nothing stored");
  const exact = upload(1_048_576);
  assert.equal(Buffer.byteLength(exact), 1_048_576);
  assert.equal((await send(api, "dev", "POST", "/activity-items", exact)).status, 200);
  assert.equal((await send(api, "dev", "POST", "/activity-items", exact, lengthOf(exact))).status, 200);
});

test("E1 summaries and standup bodies over 16 KiB are 413", async () => {
  const { api, calls } = build();
  const summaries = `{"itemIds":["${"x".repeat(16_400)}"]}`;
  const standup = `{"date":"${"x".repeat(16_400)}"}`;
  for (const [path, body] of [["/summaries", summaries], ["/standups", standup]] as const) {
    for (const extra of [{}, lengthOf(body)]) {
      const response = await send(api, "dev", "POST", path, body, extra);
      assert.equal(response.status, 413, path);
      assert.equal((await code(response)).code, "PAYLOAD_TOO_LARGE");
    }
  }
  assert.equal(calls.summaries.length + calls.standup.length, 0);
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

test("E3 an unknown top-level field is 422 and nothing is stored", async () => {
  const { api, calls } = build();
  const response = await send(api, "dev", "POST", "/activity-items", { items: [], author: "x" });
  assert.equal(response.status, 422);
  assert.equal((await code(response)).code, "VALIDATION_FAILED");
  assert.equal(calls.upload.length, 0);
});

test("E11 an empty upload through the real store is 200 with all counts 0", async () => {
  const response = await send(build({}, { real: true }).api, "dev", "POST", "/activity-items", { items: [] });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: 0, created: 0, updated: 0, unchanged: 0, rejected: [], needsSummary: [] });
});

test("F1 an upload through the real store returns real counts", async () => {
  const item = { type: "COMMIT", repo: "r", externalId: "e1", title: "t", timestamp: "2026-11-10T01:00:00Z", files: [] };
  const response = await send(build({}, { real: true }).api, "dev", "POST", "/activity-items", { items: [item, { ...item, externalId: "" }] });
  assert.equal(response.status, 200);
  const body = await response.json() as { received: number; created: number; rejected: { index: number }[]; needsSummary: string[] };
  assert.equal(body.received, 2);
  assert.equal(body.created, 1);
  assert.deepEqual(body.rejected.map((r) => r.index), [1]);
  assert.equal(body.needsSummary.length, 1);
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

test("E25 through the real standup flow, yesterday and two days ahead are 422; today and the next day are accepted", async () => {
  const { api } = build({}, { real: true });
  for (const date of ["2026-11-09", "2026-11-12"]) {
    const response = await send(api, "dev", "POST", "/standups", { date });
    assert.equal(response.status, 422, date);
    assert.equal((await code(response)).code, "VALIDATION_FAILED");
  }
  for (const body of [{ date: "2026-11-10" }, { date: "2026-11-11" }, { date: null }, {}]) {
    const response = await send(api, "dev", "POST", "/standups", body);
    assert.equal(response.status, 200, JSON.stringify(body));
  }
});

test("E25 a null date reaches the service as undefined", async () => {
  const { api, calls } = build();
  await send(api, "dev", "POST", "/standups", { date: null });
  assert.equal(calls.standup[0][2], undefined);
});

test("E35 the caller's standup for a date with none is 404 and the default date is the Singapore day", async () => {
  const { api, calls } = build({}, { now: new Date("2026-11-09T20:00:00Z") });
  const response = await send(api, "dev", "GET", "/standups/mine?date=2026-11-10");
  assert.equal(response.status, 404);
  assert.equal((await code(response)).code, "NOT_FOUND");
  assert.deepEqual(calls.mine[0].slice(2), ["2026-11-10"]);
  await send(api, "dev", "GET", "/standups/mine");
  assert.equal(calls.mine[1][2], "2026-11-10");
});

test("E35 the real runtime answers 404 for a missing standup", async () => {
  const response = await send(build({}, { real: true }).api, "dev", "GET", "/standups/mine");
  assert.equal(response.status, 404);
  assert.equal((await code(response)).code, "NOT_FOUND");
});

test("E39 a page past the end is empty and keeps the total; the query is coerced to numbers", async () => {
  const { api, calls } = build();
  const response = await send(api, "lead", "GET", "/standups?page=1&size=5");
  assert.equal(response.status, 200);
  const body = await response.json() as { items: unknown[]; total: number };
  assert.deepEqual(body.items, []);
  assert.equal(body.total, 3);
  assert.deepEqual(calls.leadList[0][2], { page: 1, size: 5 });
  assert.equal((await send(api, "lead", "GET", "/standups?page=10001")).status, 422);
});

test("E41 wrong roles get 403 FORBIDDEN_ROLE and no service call", async () => {
  const { api, calls } = build();
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
  assert.equal(Object.values(calls).flat().length, 0);
});

test("E57 an impossible or malformed date is 422 VALIDATION_FAILED on 52", async () => {
  const { api } = build();
  for (const date of ["2026-02-30", "2026-1-5"]) {
    const response = await send(api, "dev", "GET", `/standups/mine?date=${date}`);
    assert.equal(response.status, 422);
    assert.equal((await code(response)).code, "VALIDATION_FAILED");
  }
});

test("E58 bad paging, developerId or date is 422 VALIDATION_FAILED on 55", async () => {
  const { api } = build();
  for (const query of ["size=0", "size=101", "page=-1", "developerId=x", "date=2026-02-30"]) {
    const response = await send(api, "lead", "GET", `/standups?${query}`);
    assert.equal(response.status, 422, query);
    assert.equal((await code(response)).code, "VALIDATION_FAILED");
  }
});

test("E59 a Dev Lead who is not a member gets 404 NOT_FOUND on 55", async () => {
  const response = await send(build().api, "stranger", "GET", "/standups");
  assert.equal(response.status, 404);
  assert.equal((await code(response)).code, "NOT_FOUND");
});

test("a project id and a developerId in upper case reach the services in lower case", async () => {
  const { api, calls } = build();
  await send(api, "dev", "POST", "/activity-items", { items: [] }, {}, projectId.toUpperCase());
  assert.equal(calls.upload[0][1], projectId);
  const developerId = users.dev.userId;
  await send(api, "lead", "GET", `/standups?developerId=${developerId.toUpperCase()}`);
  assert.deepEqual(calls.leadList[0][2], { developerId, page: 0, size: 20 });
});

test("E36 an archived project is 409 on 49-51 and 404 on 52 and 55 through the real runtime", async () => {
  const { api } = build({}, { real: true, archived: true });
  for (const [path, body] of [["/activity-items", { items: [] }], ["/summaries", { itemIds: ids(1) }], ["/standups", {}]] as const) {
    const response = await send(api, "dev", "POST", path, body);
    assert.equal(response.status, 409, path);
    assert.equal((await code(response)).code, "CONFLICT_STATE");
  }
  for (const [who, path] of [["dev", "/standups/mine"], ["lead", "/standups"]] as const) {
    const response = await send(api, who, "GET", path);
    assert.equal(response.status, 404, path);
    assert.equal((await code(response)).code, "NOT_FOUND");
  }
});

test("E69 no token with a streamed body is 401 UNAUTHENTICATED before any of the body is read", async () => {
  const { api, calls } = build();
  let pulled = 0;
  const chunk = new Uint8Array(65_536).fill(120);
  const body = new ReadableStream<Uint8Array>({ pull(controller) { pulled++; controller.enqueue(chunk); if (pulled >= 16) controller.close(); } }, { highWaterMark: 0 });
  const response = await api.request(`${base}/uploads`, { method: "POST", headers: { "content-type": "application/json" }, body, duplex: "half" } as RequestInit);
  assert.equal(response.status, 401);
  assert.equal((await code(response)).code, "UNAUTHENTICATED");
  assert.equal(pulled, 0);
  assert.equal(calls.upload.length, 0);
});

test("E69 no token with an oversize Content-Length is 413 from the before-hook (deliberate: no body is read)", async () => {
  const response = await send(build().api, null, "POST", "/activity-items", "{}", { "content-length": "2000000" });
  assert.equal(response.status, 413);
  assert.equal((await code(response)).code, "PAYLOAD_TOO_LARGE");
});

test("DevError mapping keeps the code, status, details and Retry-After, with fixed messages", async () => {
  const details = [{ field: "reason", message: "LOCAL_LIMIT" }];
  const cases: [DevError, number, string | null, string][] = [
    [new DevError("RATE_LIMITED", 429, 30, details), 429, "30", "Too many AI requests. Try again later."],
    [new DevError("AI_BUSY", 429, 7, details), 429, "7", "The AI service is busy. Try again shortly."],
    [new DevError("AI_UNAVAILABLE", 503), 503, null, "The AI service is unavailable."],
    [new DevError("AI_DISABLED", 503), 503, null, "AI features are disabled."],
  ];
  for (const [error, status, retryAfter, message] of cases) {
    const { api } = build({ standup: async () => { throw error; } });
    const response = await send(api, "dev", "POST", "/standups", {});
    assert.equal(response.status, status, error.code);
    assert.equal(response.headers.get("retry-after"), retryAfter);
    const body = await code(response);
    assert.equal(body.code, error.code);
    assert.equal(body.message, message);
    if (error.details) assert.deepEqual(body.details, details);
  }
});

test("an upload failing with DevError RATE_LIMITED is 429 with Retry-After 1", async () => {
  const { api } = build({ upload: async () => { throw new DevError("RATE_LIMITED", 429, 1); } });
  const response = await send(api, "dev", "POST", "/activity-items", { items: [] });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal((await code(response)).code, "RATE_LIMITED");
});

test("a plain VALIDATION_FAILED error from a service is 422 with a fixed message", async () => {
  const { api } = build({ standup: async () => { throw new Error("VALIDATION_FAILED"); } });
  const response = await send(api, "dev", "POST", "/standups", {});
  assert.equal(response.status, 422);
  const body = await code(response);
  assert.equal(body.code, "VALIDATION_FAILED");
  assert.equal(body.message, "The request is not valid.");
});

test("E41 a service call is made only for the right role", async () => {
  const { api, calls } = build();
  assert.equal((await send(api, "dev", "POST", "/standups", {})).status, 200);
  assert.equal(calls.standup.length, 1);
});

test("E45 logs of every dev route, including write failures, carry no item or standup text", async () => {
  const logged: string[] = [];
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  const capture = (...args: unknown[]) => { logged.push(JSON.stringify(args, (_k, v) => (v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v))); };
  for (const name of Object.keys(originals) as (keyof typeof originals)[]) console[name] = capture;
  process.stdout.write = ((chunk: unknown) => { capture(String(chunk)); return true; }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: unknown) => { capture(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    const failing = () => { throw new Error(`write failed ${SECRET_TITLE} ${SECRET_LINE}`); };
    const { api } = build({ upload: async () => failing(), summaries: async () => failing(), standup: async () => failing(), mine: async () => failing(), leadList: async () => failing() });
    const results = [
      await send(api, "dev", "POST", "/activity-items", { items: [{ title: SECRET_TITLE, body: SECRET_LINE }] }),
      await send(api, "dev", "POST", "/summaries", { itemIds: ids(1) }),
      await send(api, "dev", "POST", "/standups", {}),
      await send(api, "dev", "GET", "/standups/mine"),
      await send(api, "lead", "GET", "/standups"),
    ];
    for (const response of results) { assert.equal(response.status, 500); assert.ok(!JSON.stringify(await response.json()).includes(SECRET_LINE)); }
  } finally { Object.assign(console, originals); process.stdout.write = stdout; process.stderr.write = stderr; }
  assert.ok(logged.length > 0, "the failures were logged");
  for (const line of logged) { assert.ok(!line.includes(SECRET_TITLE), line); assert.ok(!line.includes(SECRET_LINE), line); }
});

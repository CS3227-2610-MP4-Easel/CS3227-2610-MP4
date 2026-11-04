import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { InvalidToken, type TokenVerifier } from "@agile/auth";
import { authApp, fakeRuntime, settings, usersDb } from "./auth-fakes.js";

const TOKEN = "MKtoken7Q";
const CODE = "MKcode7Q-developer";
const IP = "198.51.100.77";
const markers = [TOKEN, CODE, IP];
const markerCodes = { PM: "pm-code-123456789", DEV_LEAD: "lead-code-12345678", DEVELOPER: CODE };
const verifier: TokenVerifier = { verify: async (token) => { if (token.startsWith(`${TOKEN}-ok`)) return { uid: token, email: `${token.length}@x.test` }; throw new InvalidToken(); } };

test("E25 markers absent from logs, bodies, headers and keys", async () => {
  const logged: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((name) => mock.method(console, name, (...args: unknown[]) => { logged.push(args.map((a) => (a instanceof Error ? `${a.name} ${a.message} ${a.stack}` : JSON.stringify(a))).join(" ")); }));
  const seen: string[] = [];
  const keys: string[] = [];
  const statuses = new Set<number>();
  const send = async (runtimeOptions: Parameters<typeof fakeRuntime>[0], path: string, body: string, token = `${TOKEN}-ok1`, times = 1) => {
    const { runtime, keys: hitKeys } = fakeRuntime({ settings: settings({ registrationCodes: markerCodes }), verifier, ...runtimeOptions });
    const app = authApp(runtime);
    for (let i = 0; i < times; i++) {
      const response = await app.request(`http://localhost/api/auth/${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-vercel-forwarded-for": IP }, body });
      statuses.add(response.status);
      seen.push(await response.text(), [...response.headers].map(([k, v]) => `${k}: ${v}`).join("\n"));
    }
    keys.push(...hitKeys);
  };
  const reg = (extra: object = {}) => JSON.stringify({ role: "DEVELOPER", code: CODE, displayName: "Dev", ...extra });
  const failure = new Error(`insert failed for ${TOKEN} ${CODE} ${IP}`);
  try {
    await send({}, "check-code", JSON.stringify({ role: "DEVELOPER", code: CODE }));            // 200
    await send({}, "check-code", JSON.stringify({ role: "PM", code: CODE }));                   // 403
    await send({}, "register", reg());                                                          // 201
    await send({ db: usersDb([{ id: "00000000-0000-4000-8000-000000000001", firebaseUid: `${TOKEN}-ok1`, email: "x@x.test", displayName: "X", role: "PM" }]) }, "register", reg()); // 409
    await send({}, "register", `{${CODE}`);                                                     // 400
    await send({}, "register", reg(), `${TOKEN}-bad`);                                          // 401
    await send({}, "register", reg({ displayName: CODE.repeat(400) }));                        // 413
    await send({}, "check-code", JSON.stringify({ role: "DEVELOPER", code: CODE.repeat(10), [CODE]: TOKEN })); // 422
    await send({}, "check-code", JSON.stringify({ role: "DEVELOPER", code: CODE }), undefined, 21); // 429
    await send({ db: usersDb([], { createFailure: failure }) }, "register", reg());             // 500 insert
    await send({ hitFails: true }, "check-code", JSON.stringify({ role: "DEVELOPER", code: CODE })); // 500 hit
  } finally { for (const spy of spies) spy.mock.restore(); }
  assert.deepEqual([...statuses].sort(), [200, 201, 400, 401, 403, 409, 413, 422, 429, 500]);
  for (const marker of markers) {
    for (const [where, values] of [["logs", logged], ["responses", seen], ["hit keys", keys]] as const) {
      assert.ok(!values.some((v) => v.includes(marker)), `${marker} found in ${where}`);
    }
  }
});

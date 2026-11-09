import { strict as assert } from "node:assert";
import { Module } from "node:module";
import * as fs from "node:fs";

const blocked = (name: string): never => { throw new Error(`W11_FORBIDDEN_${name}`); };
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => blocked("NETWORK")) as typeof fetch;
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (["node:http", "node:https", "node:net", "node:tls", "node:dns", "node:child_process"].includes(id)) blocked("NETWORK_OR_PROCESS");
  return originalRequire.call(this, id, ...args);
};
for (const name of ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "mkdir", "mkdirSync", "rm", "rmSync", "unlink", "unlinkSync"] as const) {
  const original = fs[name];
  (fs as unknown as Record<string, unknown>)[name] = (..._args: unknown[]) => blocked("FILESYSTEM");
  void original;
}
process.env.W11_NETWORK_DENY_INSTALLED = "1";
process.on("exit", () => { globalThis.fetch = originalFetch; Module.prototype.require = originalRequire; });
assert.equal(process.env.W11_NETWORK_DENY_INSTALLED, "1");

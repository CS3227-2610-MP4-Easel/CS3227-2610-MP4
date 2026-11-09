import { strict as assert } from "node:assert";
import { createRequire, Module, register, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";

const blocked = (name: string): never => { throw new Error(`W11_FORBIDDEN_${name}`); };
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => blocked("NETWORK")) as typeof fetch;
const originalRequire = Module.prototype.require;
const net = createRequire(import.meta.url)("node:net") as typeof import("node:net");
Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (["node:http", "node:https", "node:tls", "node:dns", "node:dns/promises", "node:child_process"].includes(id)) blocked("NETWORK_OR_PROCESS");
  return originalRequire.call(this, id, ...args);
};
for (const name of ["connect", "createConnection"] as const) (net[name] as unknown as (...args: unknown[]) => unknown) = (...args: unknown[]) => blocked("NETWORK_OR_PROCESS");
(net.Socket.prototype.connect as unknown as (...args: unknown[]) => unknown) = (...args: unknown[]) => blocked("NETWORK_OR_PROCESS");
syncBuiltinESMExports();
register(`data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, nextResolve) { if (["node:http","node:https","node:tls","node:dns","node:dns/promises","node:child_process"].includes(specifier)) throw new Error("W11_FORBIDDEN_NETWORK_OR_PROCESS"); return nextResolve(specifier, context); }`)}`, import.meta.url);
const fs = createRequire(import.meta.url)("node:fs") as Record<string, (...args: unknown[]) => unknown>;
const temporaryRoots = ["/node_modules/", "/private/tmp/", "/tmp/", tmpdir(), `/private${tmpdir()}`];
for (const name of ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "mkdir", "mkdirSync", "rm", "rmSync", "unlink", "unlinkSync"] as const) {
  const original = fs[name];
  fs[name] = (...args: unknown[]) => {
    const target = typeof args[0] === "string" ? args[0] : "";
    if (temporaryRoots.some((root) => target.includes(root) || target.startsWith(root))) return original(...args);
    return blocked("FILESYSTEM");
  };
}
process.env.W11_NETWORK_DENY_INSTALLED = "1";
process.on("exit", () => { globalThis.fetch = originalFetch; Module.prototype.require = originalRequire; });
assert.equal(process.env.W11_NETWORK_DENY_INSTALLED, "1");

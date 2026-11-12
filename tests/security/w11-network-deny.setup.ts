import { strict as assert } from "node:assert";
import { createRequire, Module, register, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";

const blocked = (name: string): never => { throw new Error(`W11_FORBIDDEN_${name}`); };
const originalFetch = globalThis.fetch;
globalThis.fetch = (() => blocked("NETWORK")) as typeof fetch;
const originalRequire = Module.prototype.require;
const net = createRequire(import.meta.url)("node:net") as typeof import("node:net");
Module.prototype.require = function (id: string, ...args: unknown[]) {
  if (["child_process", "node:http", "node:https", "node:tls", "node:dns", "node:dns/promises", "node:child_process"].includes(id)) blocked("NETWORK_OR_PROCESS");
  return originalRequire.call(this, id, ...args);
};
for (const name of ["connect", "createConnection"] as const) (net[name] as unknown as (...args: unknown[]) => unknown) = (...args: unknown[]) => blocked("NETWORK_OR_PROCESS");
(net.Socket.prototype.connect as unknown as (...args: unknown[]) => unknown) = (...args: unknown[]) => blocked("NETWORK_OR_PROCESS");
syncBuiltinESMExports();
register(`data:text/javascript,${encodeURIComponent(`export async function resolve(specifier, context, nextResolve) { if (["child_process","node:http","node:https","node:tls","node:dns","node:dns/promises","node:child_process"].includes(specifier)) throw new Error("W11_FORBIDDEN_NETWORK_OR_PROCESS"); return nextResolve(specifier, context); }`)}`, import.meta.url);
const fs = createRequire(import.meta.url)("node:fs") as Record<string, (...args: unknown[]) => unknown>;
const promises = createRequire(import.meta.url)("node:fs/promises") as Record<string, (...args: unknown[]) => unknown>;
const temporaryRoots = ["/node_modules/", "/private/tmp/", "/tmp/", tmpdir(), `/private${tmpdir()}`];
const filesystemWrites = ["write", "writeFile", "writeFileSync", "appendFile", "appendFileSync", "open", "openSync", "mkdir", "mkdirSync", "rm", "rmSync", "unlink", "unlinkSync", "rename", "renameSync", "copyFile", "copyFileSync", "cp", "cpSync", "link", "linkSync", "symlink", "symlinkSync", "truncate", "truncateSync", "chmod", "chmodSync", "chown", "chownSync", "utimes", "utimesSync", "lutimes", "lutimesSync", "mkdtemp", "mkdtempSync", "createWriteStream"];
const allowed = (target: string) => temporaryRoots.some((root) => {
  const relativeTarget = relative(resolve(root), resolve(target));
  return relativeTarget === "" || (!relativeTarget.startsWith("..") && !isAbsolute(relativeTarget));
});
for (const targetModule of [fs, promises]) for (const name of filesystemWrites) {
  const original = targetModule[name];
  if (typeof original !== "function") continue;
  targetModule[name] = (...args: unknown[]) => {
    const target = typeof args[0] === "string" ? args[0] : "";
    if (allowed(target)) return original(...args);
    return blocked("FILESYSTEM");
  };
}
process.env.W11_NETWORK_DENY_INSTALLED = "1";
process.on("exit", () => { globalThis.fetch = originalFetch; Module.prototype.require = originalRequire; });
assert.equal(process.env.W11_NETWORK_DENY_INSTALLED, "1");

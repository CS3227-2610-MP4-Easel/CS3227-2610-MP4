#!/usr/bin/env node
// Entry point: loads every harness/commands/*.mjs ({name, run(argv)}) and dispatches by name.
// Tasks add a command by adding a file, never by editing this one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const commandsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'commands');

export async function loadCommands() {
  const commands = new Map();
  for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).sort()) {
    const mod = await import(pathToFileURL(path.join(commandsDir, file)).href);
    commands.set(mod.name, mod);
  }
  return commands;
}

/** Returns the process exit code; 2 for an unknown command. */
export async function main(argv) {
  const [name, ...rest] = argv;
  const commands = await loadCommands();
  const cmd = commands.get(name);
  if (!cmd) {
    console.error(`usage: exp <${[...commands.keys()].join('|')}> [args]`);
    return 2;
  }
  return (await cmd.run(rest)) ?? 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

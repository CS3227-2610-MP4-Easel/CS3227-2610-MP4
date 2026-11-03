// N4: the one way the harness calls a model outside an arm (answerer, matcher, judge): no tools, a neutral
// temp directory, no session persistence, no settings, strict MCP, no plugins. The launch flags come from spawn.mjs.
import fs from 'node:fs';
import { neutralDir, noToolsArgs, runProcess } from './spawn.mjs';

export class NoToolsError extends Error {}

/** Returns {text, cost, code}; throws NoToolsError when the process fails or prints no result object. */
export async function runNoTools({ launcher, env, model, maxBudgetUsd, prompt, timeoutMs = 120000 }) {
  const cwd = neutralDir();
  try {
    const res = await runProcess({ launcher, args: noToolsArgs({ model, maxBudgetUsd }), cwd, env, input: prompt, timeoutMs });
    if (res.timedOut) throw new NoToolsError('model call timed out');
    let out;
    try { out = JSON.parse(res.stdout.trim().split('\n').filter(Boolean).pop() ?? ''); } catch { throw new NoToolsError('model call printed no JSON result'); }
    if (res.code !== 0 || out.is_error) throw new NoToolsError(`model call failed (${out.subtype ?? res.code})`);
    return { text: out.result ?? '', cost: out.total_cost_usd ?? 0, code: res.code };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}

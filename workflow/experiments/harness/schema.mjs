// Hand-written validators for every committed experiment file. Each returns {ok, errors[]}.
import path from 'node:path';

export const STAGES = ['specplan', 'implementation', 'ablation', 'model_tier'];
export const CATEGORIES = [
  'collision', 'contradiction', 'missing_limit', 'vague_term', 'wrong_path', 'missing_error', 'tenancy',
];
export const PHASES = ['spec', 'plan', 'review', 'other'];
const BYPASS_MODES = ['bypassPermissions'];
const ID_RE = /^[a-z0-9-]{3,24}$/;
const SHA_RE = /^[0-9a-f]{7,40}$/i;

export const isId = (v) => typeof v === 'string' && ID_RE.test(v);
export const isHexSha = (v) => typeof v === 'string' && SHA_RE.test(v);

/** Relative, non-empty, no `..` segment, not absolute under either path flavour. */
export function isSafeRelPath(v) {
  if (typeof v !== 'string' || v === '' || v.includes('\0')) return false;
  if (path.posix.isAbsolute(v) || path.win32.isAbsolute(v) || /^[A-Za-z]:/.test(v)) return false;
  return !v.split(/[\\/]/).includes('..');
}

const result = (errors) => ({ ok: errors.length === 0, errors });
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStrArray = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s !== '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function intIn(errors, obj, key, min, max) {
  const v = obj[key];
  if (!Number.isInteger(v) || v < min || v > max) errors.push(`${key} must be an integer ${min}-${max}`);
}

export function validateConfig(c, { pluginNames = [] } = {}) {
  const errors = [];
  if (!isObj(c)) return result(['config must be an object']);
  if (typeof c.worktrees_root !== 'string' || c.worktrees_root === '') errors.push('worktrees_root is required');
  if (typeof c.claude_bin !== 'string' || c.claude_bin === '') errors.push('claude_bin is required');
  if (!['login', 'api_key'].includes(c.auth_mode)) errors.push('auth_mode must be login or api_key');
  if (!isStrArray(c.isolation_ignore ?? [])) {
    errors.push('isolation_ignore must be a string array');
  } else {
    for (const name of c.isolation_ignore ?? []) {
      if (/^(plugin|hook):/i.test(name) || pluginNames.includes(name)) {
        errors.push(`isolation_ignore may not name a plugin or hook: ${name}`);
      }
    }
  }
  return result(errors);
}

export function validateArm(a, { fileName, pricing } = {}) {
  const errors = [];
  if (!isObj(a)) return result(['arm must be an object']);
  if (!isId(a.id)) errors.push('id must match [a-z0-9-]{3,24}');
  if (fileName && a.id !== fileName.replace(/\.json$/, '')) {
    errors.push(`id ${a.id} does not match file name ${fileName}`);
  }
  if (!STAGES.includes(a.stage)) errors.push(`stage must be one of ${STAGES.join(', ')}`);
  if (typeof a.prompt !== 'string' || a.prompt === '') {
    errors.push('prompt is required');
  } else {
    for (const m of a.prompt.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
      if (!['brief', 'task_id'].includes(m[1])) errors.push(`prompt placeholder {{${m[1]}}} is not allowed`);
    }
  }
  for (const key of ['plugins', 'skills', 'agents', 'mcp', 'allowed_tools', 'disallowed_tools']) {
    if (!isStrArray(a[key] ?? [])) errors.push(`${key} must be a string array`);
  }
  for (const p of a.plugins ?? []) {
    if (!isSafeRelPath(p) || !/^[A-Za-z0-9._-]+$/.test(p)) errors.push(`plugin must be a folder name under plugins/: ${p}`);
  }
  if (typeof a.permission_mode !== 'string' || a.permission_mode === '') {
    errors.push('permission_mode is required');
  } else if (BYPASS_MODES.includes(a.permission_mode)) {
    errors.push('permission_mode may not bypass all permissions');
  }
  if (!isObj(a.model) || typeof a.model.main !== 'string') {
    errors.push('model must be a map with a main entry');
  } else {
    for (const agent of a.agents ?? []) {
      if (typeof a.model[agent] !== 'string') errors.push(`model has no entry for agent ${agent}`);
    }
    if (pricing) {
      for (const id of new Set(Object.values(a.model))) {
        if (!pricing.models?.[id]) errors.push(`model ${id} is not in pricing.json`);
      }
    }
  }
  if (!isStrArray(a.instruction_files ?? [])) errors.push('instruction_files must be a string array');
  for (const f of a.instruction_files ?? []) {
    if (!isSafeRelPath(f)) errors.push(`instruction_files entry is not a safe relative path: ${f}`);
  }
  if (!isObj(a.artifact_globs)) {
    errors.push('artifact_globs must have spec and plan lists');
  } else {
    for (const k of ['spec', 'plan']) {
      const list = a.artifact_globs[k];
      if (!isStrArray(list)) errors.push(`artifact_globs.${k} must be a string array`);
      else for (const g of list) if (!isSafeRelPath(g)) errors.push(`artifact_globs.${k} entry is not a safe relative path: ${g}`);
    }
  }
  if (a.lint !== undefined && typeof a.lint !== 'boolean') errors.push('lint must be a boolean');
  const r = a.review ?? { lenses: [], agent_types: [], max_rounds: 0 };
  if (!isObj(r) || !isStrArray(r.lenses ?? []) || !isStrArray(r.agent_types ?? [])) {
    errors.push('review must have lenses and agent_types string arrays');
  } else if (!Number.isInteger(r.max_rounds ?? 0) || (r.max_rounds ?? 0) < 0 || (r.max_rounds ?? 0) > 2) {
    errors.push('review.max_rounds must be an integer 0-2');
  }
  if (a.phase_map !== undefined) {
    if (!isObj(a.phase_map)) errors.push('phase_map must be an object');
    else for (const [k, v] of Object.entries(a.phase_map)) if (!PHASES.includes(v)) errors.push(`phase_map ${k} has unknown phase ${v}`);
  }
  return result(errors);
}

export function validateTask(t) {
  const errors = [];
  if (!isObj(t)) return result(['task must be an object']);
  if (!isId(t.id)) errors.push('id must match [a-z0-9-]{3,24}');
  if (!isHexSha(t.base_commit)) errors.push('base_commit must be a hex sha of 7-40 characters');
  if (!isSafeRelPath(t.brief_file)) errors.push('brief_file must be a safe relative path');
  for (const k of ['sheet_file', 'issues_file']) {
    if (t[k] != null && !isSafeRelPath(t[k])) errors.push(`${k} must be a safe relative path or null`);
  }
  if (!STAGES.includes(t.stage)) errors.push(`stage must be one of ${STAGES.join(', ')}`);
  return result(errors);
}

export function validateSeededIssues(list) {
  const errors = [];
  if (!Array.isArray(list)) return result(['seeded issues must be an array']);
  const seen = new Set();
  for (const i of list) {
    if (!isObj(i)) { errors.push('issue must be an object'); continue; }
    if (typeof i.id !== 'string' || i.id === '') errors.push('issue id is required');
    else if (seen.has(i.id)) errors.push(`duplicate issue id ${i.id}`);
    else seen.add(i.id);
    if (!CATEGORIES.includes(i.category)) errors.push(`issue ${i.id}: unknown category ${i.category}`);
    if (typeof i.text !== 'string' || i.text === '') errors.push(`issue ${i.id}: text is required`);
    if (typeof i.anchor !== 'string' || i.anchor === '') errors.push(`issue ${i.id}: anchor is required`);
    if (typeof i.blocking !== 'boolean') errors.push(`issue ${i.id}: blocking must be a boolean`);
  }
  return result(errors);
}

export function validateExperiment(e) {
  const errors = [];
  if (!isObj(e)) return result(['experiment must be an object']);
  if (!isId(e.id)) errors.push('id must match [a-z0-9-]{3,24}');
  for (const k of ['task_ids', 'arm_ids']) {
    if (!isStrArray(e[k]) || e[k].length === 0) errors.push(`${k} must be a non-empty string array`);
  }
  intIn(errors, e, 'replicates', 1, 10);
  intIn(errors, e, 'max_parallel', 1, 6);
  for (const k of ['turn_timeout_s', 'run_timeout_s', 'wait_timeout_s']) {
    if (!Number.isInteger(e[k]) || e[k] <= 0) errors.push(`${k} must be a positive integer`);
  }
  for (const k of ['run_ceiling_usd', 'batch_ceiling_usd']) {
    if (!isNum(e[k]) || e[k] <= 0) errors.push(`${k} is required and must be above 0`);
  }
  if (!['sheet', 'bank'].includes(e.answer_mode)) errors.push('answer_mode must be sheet or bank');
  if (e.pruning_rule !== 'dominance') errors.push('pruning_rule must be dominance');
  if (!isStrArray(e.hypotheses ?? [])) errors.push('hypotheses must be a string array');
  if (typeof e.decision_rule !== 'string' || e.decision_rule === '') errors.push('decision_rule is required');
  return result(errors);
}

const PRICE_FIELDS = ['input', 'output', 'cache_read', 'cache_write_5m', 'cache_write_1h'];

export function validatePricing(p) {
  const errors = [];
  if (!isObj(p)) return result(['pricing must be an object']);
  if (p.schema_version !== 1) errors.push('schema_version must be 1');
  if (!isObj(p.models)) return result([...errors, 'models must be an object']);
  for (const [model, price] of Object.entries(p.models)) {
    if (!isObj(price)) { errors.push(`${model}: entry must be an object`); continue; }
    for (const f of PRICE_FIELDS) {
      if (!isNum(price[f]) || price[f] < 0) errors.push(`${model}: ${f} must be a number of 0 or more`);
    }
    if (typeof price.source !== 'string' || price.source === '') errors.push(`${model}: source is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(price.checked ?? '')) errors.push(`${model}: checked must be a YYYY-MM-DD date`);
  }
  return result(errors);
}

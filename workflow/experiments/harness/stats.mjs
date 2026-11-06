// F13, E49, E50: medians, geometric means with exclusions, and pair verdicts (runtime.md § Reports). Declares no winner.

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Middle value; the mean of the middle two for even n; null for no values. */
export function median(values) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export const minOf = (values) => { const v = values.filter(isNum); return v.length ? Math.min(...v) : null; };
export const maxOf = (values) => { const v = values.filter(isNum); return v.length ? Math.max(...v) : null; };

/**
 * Geometric mean over per-task medians. A zero or empty median is excluded (gm_excluded); one task is flagged
 * single_task. Returns {gm, excluded, single_task}; gm is null when nothing is left.
 */
export function geometricMean(taskMedians) {
  const usable = taskMedians.filter((m) => isNum(m) && m > 0);
  const excluded = taskMedians.length - usable.length;
  const gm = usable.length ? Math.exp(usable.reduce((s, m) => s + Math.log(m), 0) / usable.length) : null;
  return { gm, excluded, single_task: taskMedians.length === 1 };
}

const overlap = (a, b) => a[0] <= b[1] && b[0] <= a[1];

/**
 * Summary of one arm from its runs: {n, graded, medCost, medRubric, medIssues, costRange, rubricRange}.
 * Cost uses every run; quality uses only graded runs (aborted and ungraded runs are left out of it).
 */
export function summarizeArm(runs) {
  const graded = runs.filter((r) => isNum(r.rubric_total));
  return {
    n: runs.length, graded: graded.length,
    medCost: median(runs.map((r) => r.arm_cost_usd)),
    medRubric: median(graded.map((r) => r.rubric_total)),
    medIssues: median(graded.map((r) => r.issues_found)),
    costRange: [minOf(runs.map((r) => r.arm_cost_usd)), maxOf(runs.map((r) => r.arm_cost_usd))],
    rubricRange: [minOf(graded.map((r) => r.rubric_total)), maxOf(graded.map((r) => r.rubric_total))],
  };
}

const dominates = (y, x) => // y dominates x
  x.medCost > y.medCost && x.medRubric < y.medRubric && (x.medIssues ?? 0) <= (y.medIssues ?? 0)
  && (!overlap(x.costRange, y.costRange) || !overlap(x.rubricRange, y.rubricRange));

/**
 * Verdict for arms X and Y: `inconclusive` below 3 replicates; `dominated(X by Y)` by the rule of runtime.md; otherwise
 * `inconclusive` when both ranges overlap, `tradeoff` when the medians disagree in direction, else `inconclusive`.
 */
export function verdict(xName, x, yName, y) {
  if (x.n < 3 || y.n < 3 || x.graded < 3 || y.graded < 3) return 'inconclusive';
  if (dominates(y, x)) return `dominated(${xName} by ${yName})`;
  if (dominates(x, y)) return `dominated(${yName} by ${xName})`;
  if (overlap(x.costRange, y.costRange) && overlap(x.rubricRange, y.rubricRange)) return 'inconclusive';
  const costDir = Math.sign(x.medCost - y.medCost);
  const rubricDir = Math.sign(x.medRubric - y.medRubric);
  return costDir !== 0 && rubricDir !== 0 && costDir === rubricDir ? 'tradeoff' : 'inconclusive';
}

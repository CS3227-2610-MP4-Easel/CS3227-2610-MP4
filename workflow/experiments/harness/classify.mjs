// Classification of a turn's final assistant message (runtime.md § Driver rules).
export const DONE_MARKER = 'EXP-DONE';

export const STATUS_MAX_CHARS = 300;
const WAITING = /\b(wait(?:ing)?\s+(?:for|on|until)|still running|(?:is|are) running|has resumed|have resumed|completion notice|reports? back)\b/i;

/**
 * A status update: a short message with no question mark that says the agent is waiting on background work
 * ("The reviewer is running. I'll wait for its findings."). It asks the operator nothing, so it is not a question.
 * A message longer than STATUS_MAX_CHARS, or with a question mark, is never a status update.
 */
export function isStatusUpdate(text) {
  const t = String(text ?? '').trim();
  return t.length > 0 && t.length <= STATUS_MAX_CHARS && !t.includes('?') && WAITING.test(t);
}

/**
 * `empty` = only whitespace; `done` = last non-empty line, trimmed, is exactly EXP-DONE; `status` = a status update
 * (isStatusUpdate); else `question`.
 */
export function classifyTurn(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) return 'empty';
  if (lines[lines.length - 1] === DONE_MARKER) return 'done';
  return isStatusUpdate(text) ? 'status' : 'question';
}

/** True when a done message also carries a question earlier in the text (stored with note ignored_after_done). */
export function hasQuestionBeforeDone(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  return lines.length > 1 && lines[lines.length - 1] === DONE_MARKER && lines.slice(0, -1).some((l) => l.includes('?'));
}

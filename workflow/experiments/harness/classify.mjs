// Classification of a turn's final assistant message (runtime.md § Driver rules).
export const DONE_MARKER = 'EXP-DONE';

/** `empty` = only whitespace; `done` = last non-empty line, trimmed, is exactly EXP-DONE; else `question`. */
export function classifyTurn(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  if (lines.length === 0) return 'empty';
  return lines[lines.length - 1] === DONE_MARKER ? 'done' : 'question';
}

/** True when a done message also carries a question earlier in the text (stored with note ignored_after_done). */
export function hasQuestionBeforeDone(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  return lines.length > 1 && lines[lines.length - 1] === DONE_MARKER && lines.slice(0, -1).some((l) => l.includes('?'));
}

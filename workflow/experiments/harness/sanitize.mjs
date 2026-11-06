// Text from an agent is untrusted: strip terminal control, hide paths and credentials, cap the length (E36).
import { redact } from './secrets.mjs';

export const MAX_TEXT = 2000;

// ESC sequences: CSI (ESC [ ... final), OSC (ESC ] ... BEL or ESC \), and any other two-character ESC sequence.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
// Windows drive path, UNC path, and a POSIX path of two or more segments (not part of a URL).
const PATHS = [/[A-Za-z]:\\[^\s]+/g, /\\\\[^\s]+/g, /(?<![\w:/])\/[^\s/]+(?:\/[^\s/]+)+/g];

export function sanitizeText(text, { max = MAX_TEXT } = {}) {
  let t = String(text ?? '').replace(ANSI, '').replace(/\r\n?/g, '\n').replace(CONTROL, '');
  t = redact(t);
  for (const re of PATHS) t = t.replace(re, '<path>');
  return t.length > max ? t.slice(0, max) : t;
}

/** True when a digits-only Content-Length already exceeds the limit; never reads the body. */
export function contentLengthTooLarge(request: Request, maxBytes: number): boolean {
  const length = request.headers.get("content-length");
  return length !== null && /^\d+$/.test(length) && Number(length) > maxBytes;
}

/** Counts body bytes as they stream in and stops past the limit, so an oversized body is never buffered whole. */
export async function readLimitedBody(request: Request, maxBytes: number): Promise<{ tooLarge: true } | { tooLarge: false; text: string }> {
  if (contentLengthTooLarge(request, maxBytes)) return { tooLarge: true };
  const reader = request.body?.getReader();
  if (!reader) return { tooLarge: false, text: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    // Not awaited: cancelling one branch of a cloned body settles only when the other branch is cancelled too.
    if (total > maxBytes) { reader.cancel().catch(() => {}); return { tooLarge: true }; }
    chunks.push(value);
  }
  return { tooLarge: false, text: new TextDecoder("utf-8").decode(Buffer.concat(chunks)) };
}

/** Same count over a clone, for `before` hooks that must leave the body for later parsing. */
export async function bodyTooLarge(request: Request, maxBytes: number): Promise<boolean> {
  return (await readLimitedBody(request.clone(), maxBytes)).tooLarge;
}

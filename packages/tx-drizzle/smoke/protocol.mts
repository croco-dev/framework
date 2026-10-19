/** Both HTTP directions are bounded before decoding or parsing untrusted text. */
export async function readSmokeBody(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal = AbortSignal.timeout(10_000),
): Promise<string | undefined> {
  if (!stream) return "";
  const reader = stream.getReader();
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(next.value);
    }
    if (signal.aborted) return undefined;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return new TextDecoder().decode(bytes);
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

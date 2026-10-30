import type { StorageStream } from "@croco/storage-core";
import { R2ObjectTooLargeProblem } from "./problems/R2ObjectTooLargeProblem";

const MAX_BUFFERED_GET_BYTES = 10 * 1024 * 1024;

/** Both R2 transports enforce the same bounded, platform-independent buffered read. */
export async function readBufferedR2Stream(
  key: string,
  stream: StorageStream,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > MAX_BUFFERED_GET_BYTES)
      throw new R2ObjectTooLargeProblem(key, MAX_BUFFERED_GET_BYTES);
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

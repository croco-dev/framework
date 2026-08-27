import type { StorageBody, StorageStream } from "./types";

export function storageStreamFromBytes(bytes: Uint8Array): StorageStream {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export async function readStorageStream(stream: StorageStream): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    chunks.push(chunk);
    totalBytes += chunk.byteLength;
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export async function readStorageBody(body: StorageBody): Promise<Uint8Array> {
  return body instanceof Uint8Array ? body : readStorageStream(body);
}

import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import { InvalidNodeStorageBodyProblem } from "./problems/InvalidNodeStorageBodyProblem";
import type { StorageBody, StorageStream } from "./types";

export function nodeReadableToStorageStream(stream: Readable): StorageStream {
  return Readable.toWeb(Readable.from(toStorageChunks(stream))) as StorageStream;
}

export function storageStreamToNodeReadable(stream: StorageStream): Readable {
  return Readable.fromWeb(stream as NodeReadableStream);
}

export function nodeStorageBody(data: Uint8Array | Readable): StorageBody {
  return data instanceof Uint8Array ? data : nodeReadableToStorageStream(data);
}

async function* toStorageChunks(stream: Readable): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();

  for await (const rawChunk of stream) {
    const chunk: unknown = rawChunk;

    if (chunk instanceof Uint8Array) {
      yield chunk;
      continue;
    }

    if (typeof chunk === "string") {
      yield encoder.encode(chunk);
      continue;
    }

    throw new InvalidNodeStorageBodyProblem(typeof chunk);
  }
}

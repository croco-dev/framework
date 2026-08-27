import { Readable } from "node:stream";

import { describe, expect, it } from "vitest";

import {
  nodeReadableToStorageStream,
  nodeStorageBody,
  storageStreamToNodeReadable,
} from "../libs/nodeInterop";
import { InvalidNodeStorageBodyProblem } from "../libs/problems/InvalidNodeStorageBodyProblem";
import { readStorageStream, storageStreamFromBytes } from "../libs/storageBody";

describe("Node storage stream interop", () => {
  it("converts a Node readable to a portable storage stream without buffering it first", async () => {
    const source = Readable.from([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);

    await expect(readStorageStream(nodeReadableToStorageStream(source))).resolves.toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  it("converts a portable storage stream to a Node readable", async () => {
    const readable = storageStreamToNodeReadable(
      storageStreamFromBytes(new Uint8Array([1, 2, 3, 4])),
    );
    const chunks: Uint8Array[] = [];

    for await (const chunk of readable) {
      chunks.push(chunk as Uint8Array);
    }

    expect(chunks.map((chunk) => [...chunk])).toEqual([[1, 2, 3, 4]]);
  });

  it("encodes string chunks from Node readables as UTF-8 bytes", async () => {
    await expect(
      readStorageStream(nodeReadableToStorageStream(Readable.from(["croco"]))),
    ).resolves.toEqual(new TextEncoder().encode("croco"));
  });

  it("rejects object-mode Node readable chunks instead of violating the byte contract", async () => {
    await expect(
      readStorageStream(nodeReadableToStorageStream(Readable.from([{ value: "croco" }]))),
    ).rejects.toBeInstanceOf(InvalidNodeStorageBodyProblem);
  });

  it("keeps Uint8Array bodies unchanged and adapts Node readable bodies", () => {
    const bytes = new Uint8Array([1]);

    expect(nodeStorageBody(bytes)).toBe(bytes);
    expect(nodeStorageBody(Readable.from([bytes]))).toBeInstanceOf(ReadableStream);
  });
});

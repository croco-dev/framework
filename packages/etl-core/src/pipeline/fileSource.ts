import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { decodeSource } from "../source/decodeSource";
import { SourceDecodeProblem } from "../source/SourceDecodeProblem";
import type { Checkpointable, ItemReader } from "@croco/batch-core";
import type { SourceRow, SourceSchema } from "../source/types";

export type FileSource = {
  readonly id: string;
  readonly path: string;
  readonly schema: SourceSchema;
  readonly revision: string;
  readonly replayability: "snapshot-stable" | "mutable" | "non-replayable";
};

export type FileSourceRecord = { readonly row: SourceRow; readonly record: number };
export type FileSourceCheckpoint = {
  readonly sourceId: string;
  readonly revision: string;
  readonly record: number;
};
export interface FileSourceReader extends ItemReader<FileSourceRecord>, Checkpointable {
  readonly recordCount: number;
  getCheckpoint(): FileSourceCheckpoint;
  close(): Promise<void>;
}

export class FileSourceProblem extends Problem {
  readonly code = "etl-core/file-source-failed";
  readonly category = ProblemCategory.ValidationError;
  constructor(
    readonly reason:
      | "invalid-source"
      | "unsupported-replay"
      | "revision-mismatch"
      | "invalid-checkpoint"
      | "closed"
      | "io",
    detail: string,
  ) {
    super(undefined, undefined, detail, { extensions: { reason } });
  }
}

export async function openFileSource(source: FileSource): Promise<FileSourceReader> {
  if (!source.id || !source.path || !/^[a-f0-9]{64}$/.test(source.revision)) {
    throw new FileSourceProblem(
      "invalid-source",
      "File source requires an id, path, and lowercase SHA-256 revision.",
    );
  }
  if (!["snapshot-stable", "mutable", "non-replayable"].includes(source.replayability)) {
    throw new FileSourceProblem("invalid-source", "File source must declare its replayability.");
  }
  const schema = structuredClone(source.schema);
  decodeSource(emptyBytes(), schema);
  const sourceId = source.id;
  const revision = source.revision;
  const replayability = source.replayability;
  const directory = await mkdtemp(join(tmpdir(), "croco-etl-"));
  const snapshot = join(directory, "snapshot");
  try {
    const hash = createHash("sha256");
    let size = 0;
    await pipeline(
      createReadStream(source.path),
      async function* (chunks) {
        for await (const chunk of chunks) {
          const bytes = chunk as Buffer;
          size += bytes.byteLength;
          if (size > schema.limits.maxBytes) {
            throw new SourceDecodeProblem(
              "byte-limit",
              { byteOffset: size, line: 1, column: 1 },
              `Source exceeds ${schema.limits.maxBytes} bytes`,
            );
          }
          hash.update(bytes);
          yield bytes;
        }
      },
      createWriteStream(snapshot, { flags: "wx", mode: 0o600 }),
    );
    if (hash.digest("hex") !== revision) {
      throw new FileSourceProblem(
        "revision-mismatch",
        "File content does not match its declared revision.",
      );
    }
    await chmod(snapshot, 0o400);
    let recordCount = 0;
    for await (const _row of decodeSource(verifiedBytes(snapshot, revision), schema)) recordCount++;
    let iterator: AsyncIterator<SourceRow> = decodeSource(
      verifiedBytes(snapshot, revision),
      schema,
    )[Symbol.asyncIterator]();
    let cursor = 0;
    let replay = false;
    let closed = false;
    const ensureOpen = (): void => {
      if (closed) throw new FileSourceProblem("closed", "File source reader is closed.");
    };
    return {
      recordCount,
      async read() {
        ensureOpen();
        if (replay) {
          await iterator.return?.();
          iterator = decodeSource(verifiedBytes(snapshot, revision), schema)[
            Symbol.asyncIterator
          ]();
          for (let index = 0; index < cursor; index++) await iterator.next();
          replay = false;
        }
        const next = await iterator.next();
        if (next.done) return null;
        cursor++;
        return { row: next.value, record: cursor };
      },
      getCheckpoint() {
        ensureOpen();
        return { sourceId, revision, record: cursor };
      },
      restoreCheckpoint(checkpoint: unknown) {
        ensureOpen();
        if (
          checkpoint === null ||
          typeof checkpoint !== "object" ||
          !("sourceId" in checkpoint) ||
          checkpoint.sourceId !== sourceId ||
          !("revision" in checkpoint) ||
          checkpoint.revision !== revision ||
          !("record" in checkpoint) ||
          typeof checkpoint.record !== "number" ||
          !Number.isSafeInteger(checkpoint.record) ||
          checkpoint.record < 0 ||
          checkpoint.record > recordCount
        ) {
          throw new FileSourceProblem(
            "invalid-checkpoint",
            "Checkpoint must identify this source revision and an existing record boundary.",
          );
        }
        if (
          replayability === "non-replayable" ||
          (replayability === "mutable" && checkpoint.record !== 0)
        ) {
          throw new FileSourceProblem(
            "unsupported-replay",
            "Only snapshot-stable sources support offset replay; mutable partitions must restart at record zero and non-replayable sources cannot restore.",
          );
        }
        cursor = checkpoint.record;
        replay = true;
      },
      async close() {
        if (closed) return;
        closed = true;
        try {
          await iterator.return?.();
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    if (error instanceof Problem) throw error;
    throw new FileSourceProblem(
      "io",
      `Unable to capture file source: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function* emptyBytes(): AsyncGenerator<Uint8Array> {}

async function* verifiedBytes(path: string, revision: string): AsyncGenerator<Uint8Array> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    const bytes = chunk as Buffer;
    hash.update(bytes);
    yield bytes;
  }
  if (hash.digest("hex") !== revision)
    throw new FileSourceProblem("revision-mismatch", "Captured source content changed.");
}

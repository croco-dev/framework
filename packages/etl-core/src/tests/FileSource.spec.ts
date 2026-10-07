import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSourceProblem, openFileSource } from "../pipeline/fileSource";
import { SourceDecodeProblem } from "../source/SourceDecodeProblem";
import type { FileSource, FileSourceReader } from "../pipeline/fileSource";

const directories: string[] = [];
const readers: FileSourceReader[] = [];
async function source(content: string, format: "csv" | "jsonl" = "jsonl"): Promise<FileSource> {
  const directory = await mkdtemp(join(tmpdir(), "etl-reader-test-"));
  directories.push(directory);
  const path = join(directory, "source");
  await writeFile(path, content);
  return {
    id: "orders",
    path,
    revision: createHash("sha256").update(content).digest("hex"),
    replayability: "snapshot-stable",
    schema: {
      ...(format === "csv" ? { header: true } : {}),
      format,
      encoding: "utf-8",
      fields: [{ name: "name", type: "string" }],
      limits: { maxBytes: 100000, maxRowBytes: 1000, maxRecords: 1000 },
    },
  };
}
async function open(input: FileSource) {
  const reader = await openFileSource(input);
  readers.push(reader);
  return reader;
}
afterEach(async () => {
  await Promise.all(readers.splice(0).map((reader) => reader.close()));
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("file source reader", () => {
  it("replays CSV logical records including quoted newlines and UTF-8", async () => {
    const input = await source('name\n"가\n나"\nlast\n', "csv");
    const reader = await open(input);
    expect(reader.recordCount).toBe(2);
    expect(await reader.read()).toEqual({ row: { name: "가\n나" }, record: 1 });
    const checkpoint = reader.getCheckpoint();
    const resumed = await open(input);
    resumed.restoreCheckpoint(checkpoint);
    expect(await resumed.read()).toEqual({ row: { name: "last" }, record: 2 });
    expect(await resumed.read()).toBeNull();
    resumed.restoreCheckpoint(checkpoint);
    expect(await resumed.read()).toEqual({ row: { name: "last" }, record: 2 });
  });

  it("uses the verified captured bytes even if the original file changes", async () => {
    const input = await source('{"name":"first"}\n{"name":"second"}\n');
    const reader = await open(input);
    await writeFile(input.path, '{"name":"changed"}\n');
    expect(await reader.read()).toEqual({ row: { name: "first" }, record: 1 });
    expect(await reader.read()).toEqual({ row: { name: "second" }, record: 2 });
    expect(await reader.read()).toBeNull();
    await expect(openFileSource(input)).rejects.toMatchObject({ reason: "revision-mismatch" });
  });

  it("rejects invalid checkpoints before reading, including past EOF", async () => {
    const input = await source('{"name":"one"}\n');
    const reader = await open(input);
    const checkpoint = reader.getCheckpoint();
    for (const record of [-1, 0.5, 2, NaN, Infinity]) {
      expect(() => reader.restoreCheckpoint({ ...checkpoint, record })).toThrow(FileSourceProblem);
    }
    expect(() => reader.restoreCheckpoint({ ...checkpoint, revision: "0".repeat(64) })).toThrow(
      FileSourceProblem,
    );
    expect(() => reader.restoreCheckpoint({ ...checkpoint, sourceId: "other" })).toThrow(
      FileSourceProblem,
    );
    reader.restoreCheckpoint({ ...checkpoint, record: 1 });
    expect(await reader.read()).toBeNull();
  });

  it("restarts mutable partitions at zero and rejects offset or non-replayable restore", async () => {
    const input = await source('{"name":"one"}\n{"name":"two"}\n');
    const mutable = { ...input, replayability: "mutable" as const };
    const first = await open(mutable);
    await first.read();
    const checkpoint = first.getCheckpoint();
    const retry = await open(mutable);
    expect(() => retry.restoreCheckpoint(checkpoint)).toThrow(FileSourceProblem);
    retry.restoreCheckpoint({ ...checkpoint, record: 0 });
    expect(await retry.read()).toEqual({ row: { name: "one" }, record: 1 });
    await writeFile(input.path, '{"name":"changed"}\n');
    await expect(openFileSource(mutable)).rejects.toMatchObject({ reason: "revision-mismatch" });
    const nonReplayable = await open({
      ...(await source('{"name":"one"}\n')),
      replayability: "non-replayable",
    });
    expect(() => nonReplayable.restoreCheckpoint(nonReplayable.getCheckpoint())).toThrow(
      FileSourceProblem,
    );
    expect(await nonReplayable.read()).toEqual({ row: { name: "one" }, record: 1 });
    await expect(openFileSource({ ...input, revision: "not-a-digest" })).rejects.toMatchObject({
      reason: "invalid-source",
    });
  });

  it("validates the entire source and bounds before returning a reader", async () => {
    const invalid = await source('{"name":"first"}\ninvalid\n');
    await expect(openFileSource(invalid)).rejects.toBeInstanceOf(SourceDecodeProblem);
    const input = await source('{"name":"one"}\n{"name":"two"}\n');
    for (const limits of [{ maxBytes: 1 }, { maxRowBytes: 1 }, { maxRecords: 1 }]) {
      await expect(
        openFileSource({
          ...input,
          schema: { ...input.schema, limits: { ...input.schema.limits, ...limits } },
        }),
      ).rejects.toBeInstanceOf(SourceDecodeProblem);
    }
  });

  it("closes an interrupted iterator and makes further reads fail explicitly", async () => {
    const reader = await open(await source('{"name":"one"}\n{"name":"two"}\n'));
    await reader.read();
    await reader.close();
    await reader.close();
    await expect(reader.read()).rejects.toMatchObject({ reason: "closed" });
    expect(() => reader.getCheckpoint()).toThrow(FileSourceProblem);
  });
});

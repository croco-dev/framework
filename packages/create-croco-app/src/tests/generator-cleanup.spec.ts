import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFailureResult } from "../cli-result.js";
import { PnpmCommandProblem } from "../libs/problems/PnpmCommandProblem.js";
import type * as stagingModule from "../staging.js";
import type { GeneratorOptions } from "../types.js";

const execSyncMock = vi.hoisted(() => vi.fn());
const spawnMock = vi.hoisted(() => vi.fn());
const cleanupMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
  spawn: spawnMock,
}));

vi.mock("../staging.js", async (importOriginal) => {
  const original = await importOriginal<typeof stagingModule>();
  return {
    ...original,
    removeOwnedStagingDirectory: cleanupMock,
  };
});

const baseOptions: GeneratorOptions = {
  projectName: "my-blank",
  scope: "@test",
  preset: "blank",
  webApps: [],
  apiHosting: "standalone",
  db: [],
  agentRules: false,
  installDeps: true,
  initGit: false,
};

describe("generate() staging cleanup evidence", () => {
  let testRoot: string;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "croco-cleanup-test-"));
    execSyncMock.mockReset();
    spawnMock.mockReset();
    cleanupMock.mockReset();
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("preserves the primary Problem when staging cleanup also fails", async () => {
    const { generate } = await import("../generator.js");
    spawnMock.mockImplementationOnce(() => {
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      queueMicrotask(() => child.emit("error", new Error("pnpm unavailable")));
      return child;
    });
    cleanupMock.mockImplementationOnce(() => {
      throw new Error("staging directory is locked");
    });

    const error = await generate(join(testRoot, "target"), baseOptions).catch(
      (cause: unknown) => cause,
    );

    expect(error).toBeInstanceOf(PnpmCommandProblem);
    expect(createFailureResult(error)).toMatchObject({
      code: "create-croco-app/pnpm-unavailable",
      unexpected: false,
      stagingCleanup: {
        ok: false,
        detail: "Error: staging directory is locked",
      },
    });
  }, 15_000);

  it("does not clean the former staging path after publishing succeeds", async () => {
    const { generate } = await import("../generator.js");

    await generate(join(testRoot, "target"), { ...baseOptions, installDeps: false });

    expect(cleanupMock).not.toHaveBeenCalled();
  });
});

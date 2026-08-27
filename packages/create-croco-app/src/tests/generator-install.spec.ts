import { EventEmitter } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DirectoryNotEmptyProblem } from "../libs/problems/DirectoryNotEmptyProblem.js";
import { PnpmCommandProblem } from "../libs/problems/PnpmCommandProblem.js";
import type { GeneratorOptions } from "../types.js";

const execSyncMock = vi.hoisted(() => vi.fn());
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  execSync: execSyncMock,
  spawn: spawnMock,
}));

const baseOptions: GeneratorOptions = {
  projectName: "my-blank",
  scope: "@test",
  preset: "blank",
  webApps: [],
  apiHosting: "standalone",
  db: [],
  agentRules: false,
  installDeps: false,
  initGit: false,
};

describe("generate() pnpm install contract", () => {
  let testDir: string;
  let testRoot: string;
  let failedSpawnCall: number | undefined;
  let spawnSideEffect: ((callNumber: number) => void) | undefined;

  beforeEach(() => {
    testRoot = mkdtempSync(join(tmpdir(), "croco-install-test-"));
    testDir = join(testRoot, "target");
    execSyncMock.mockReset();
    failedSpawnCall = undefined;
    spawnSideEffect = undefined;
    configureSpawnMock();
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it("runs pnpm install when dependency installation is enabled", async () => {
    const { generate } = await import("../generator.js");

    const result = await generate(testDir, {
      ...baseOptions,
      installDeps: true,
    });

    const installDir = spawnMock.mock.calls[1]?.[1]?.cwd as string;

    expect(dirname(installDir)).toBe(testRoot);
    expect(basename(installDir).startsWith(`.croco-stage-${process.pid}-`)).toBe(true);
    expect(installDir).not.toBe(testDir);
    expect(spawnMock.mock.calls).toEqual([
      ["pnpm --version", { cwd: installDir, shell: true, stdio: ["ignore", "ignore", "ignore"] }],
      [
        "pnpm install --no-frozen-lockfile",
        { cwd: installDir, shell: true, stdio: ["ignore", "inherit", "inherit"] },
      ],
      [
        "pnpm install --lockfile-only --frozen-lockfile",
        { cwd: installDir, shell: true, stdio: ["ignore", "inherit", "inherit"] },
      ],
    ]);
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
    expect(JSON.parse(readFileSync(join(testDir, "package.json"), "utf8")).packageManager).toBe(
      "pnpm@11.9.0",
    );
    expect(result.postActions.dependencies).toBe("installed");
    expect(result.nextSteps).toEqual([{ command: "pnpm", args: ["dev"], cwd: testDir }]);
  }, 15_000);

  it("keeps --no-install as an escape hatch from pnpm", async () => {
    const { generate } = await import("../generator.js");

    await generate(testDir, baseOptions);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(existsSync(join(testDir, "pnpm-workspace.yaml"))).toBe(true);
  });

  it("initializes Git inside staging before publishing the project", async () => {
    const { generate } = await import("../generator.js");

    const result = await generate(testDir, { ...baseOptions, initGit: true });

    const gitDir = execSyncMock.mock.calls[0]?.[1]?.cwd as string;
    expect(execSyncMock).toHaveBeenCalledWith("git init", { cwd: gitDir, stdio: "ignore" });
    expect(dirname(gitDir)).toBe(testRoot);
    expect(basename(gitDir).startsWith(`.croco-stage-${process.pid}-`)).toBe(true);
    expect(gitDir).not.toBe(testDir);
    expect(existsSync(join(testDir, "package.json"))).toBe(true);
    expect(result.postActions.git).toBe("initialized");
  });

  it("reports an actionable Problem when pnpm is unavailable", async () => {
    const { generate } = await import("../generator.js");

    failedSpawnCall = 1;

    const error = await generate(testDir, {
      ...baseOptions,
      installDeps: true,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(PnpmCommandProblem);
    expect((error as PnpmCommandProblem).toJSON()).toMatchObject({
      code: "create-croco-app/pnpm-unavailable",
      stage: "availability-check",
      command: "pnpm --version",
      recovery: expect.stringContaining("--no-install"),
    });
    expect(existsSync(testDir)).toBe(false);
    expect(findStagingDirectories(testDir)).toEqual([]);

    failedSpawnCall = undefined;
    configureSpawnMock();
    await generate(testDir, { ...baseOptions, installDeps: true });
    expect(existsSync(join(testDir, "package.json"))).toBe(true);
  });

  it.each([
    {
      failedCall: 2,
      code: "create-croco-app/dependency-install-failed",
      stage: "dependency-install",
      command: "pnpm install --no-frozen-lockfile",
    },
    {
      failedCall: 3,
      code: "create-croco-app/lockfile-validation-failed",
      stage: "lockfile-validation",
      command: "pnpm install --lockfile-only --frozen-lockfile",
    },
  ])(
    "reports an actionable Problem when $stage fails",
    async ({ failedCall, code, stage, command }) => {
      const { generate } = await import("../generator.js");

      failedSpawnCall = failedCall;

      const error = await generate(testDir, {
        ...baseOptions,
        installDeps: true,
      }).catch((cause: unknown) => cause);

      expect(error).toBeInstanceOf(PnpmCommandProblem);
      expect((error as PnpmCommandProblem).toJSON()).toMatchObject({
        code,
        stage,
        command,
        recovery: expect.stringContaining("--no-install"),
      });
      expect(existsSync(testDir)).toBe(false);
      expect(findStagingDirectories(testDir)).toEqual([]);

      failedSpawnCall = undefined;
      configureSpawnMock();
      await generate(testDir, { ...baseOptions, installDeps: true });
      expect(existsSync(join(testDir, "package.json"))).toBe(true);
    },
  );

  it("preserves files created by another process before publish", async () => {
    const { generate } = await import("../generator.js");
    const externalFile = join(testDir, "owned-by-another-process.txt");

    spawnSideEffect = (callNumber) => {
      if (callNumber === 2) {
        mkdirSync(testDir, { recursive: true });
        writeFileSync(externalFile, "keep me\n");
      }
    };

    const error = await generate(testDir, {
      ...baseOptions,
      installDeps: true,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(DirectoryNotEmptyProblem);
    expect(readFileSync(externalFile, "utf8")).toBe("keep me\n");
    expect(readdirSync(testDir)).toEqual(["owned-by-another-process.txt"]);
    expect(findStagingDirectories(testDir)).toEqual([]);
  });

  it("publishes into an existing empty target directory", async () => {
    const { generate } = await import("../generator.js");
    mkdirSync(testDir, { recursive: true });

    await generate(testDir, baseOptions);

    expect(existsSync(join(testDir, "package.json"))).toBe(true);
    expect(findStagingDirectories(testDir)).toEqual([]);
  });

  it("rejects an existing file target with a structured Problem", async () => {
    const { generate } = await import("../generator.js");
    writeFileSync(testDir, "keep me\n");

    const error = await generate(testDir, baseOptions).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(DirectoryNotEmptyProblem);
    expect(readFileSync(testDir, "utf8")).toBe("keep me\n");
    expect(findStagingDirectories(testDir)).toEqual([]);
  });

  it.runIf(process.platform !== "win32")(
    "publishes the target with normal directory permissions",
    async () => {
      const { generate } = await import("../generator.js");
      const expectedMode = 0o777 & ~process.umask();

      await generate(testDir, baseOptions);

      expect(statSync(testDir).mode & 0o777).toBe(expectedMode);
    },
  );

  it("supports target names near the filesystem component limit", async () => {
    const { generate } = await import("../generator.js");
    const longTargetDir = join(testRoot, "a".repeat(240));

    await generate(longTargetDir, baseOptions);

    expect(existsSync(join(longTargetDir, "package.json"))).toBe(true);
    expect(findStagingDirectories(longTargetDir)).toEqual([]);
  });

  it("suppresses pnpm output without buffering for JSON consumers", async () => {
    const { generate } = await import("../generator.js");

    await generate(testDir, { ...baseOptions, installDeps: true }, { outputMode: "json" });

    const installDir = spawnMock.mock.calls[1]?.[1]?.cwd as string;
    expect(spawnMock).toHaveBeenCalledTimes(3);
    for (const [command, options] of spawnMock.mock.calls) {
      expect(command).toMatch(/^pnpm /);
      expect(options.cwd).toBe(installDir);
      expect(options.stdio).toEqual(["ignore", "ignore", "ignore"]);
    }
  });

  function configureSpawnMock(): void {
    spawnMock.mockReset();
    spawnMock.mockImplementation((command: string) => {
      const callNumber = spawnMock.mock.calls.length;
      const child = new EventEmitter() as EventEmitter & {
        stdout: PassThrough;
        stderr: PassThrough;
      };
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();

      queueMicrotask(() => {
        spawnSideEffect?.(callNumber);
        if (failedSpawnCall === callNumber) {
          child.stderr.write(`${command} failed\n`);
          child.emit("close", 1, null);
          return;
        }
        child.emit("close", 0, null);
      });

      return child;
    });
  }
});

function findStagingDirectories(targetDir: string): string[] {
  return readdirSync(dirname(targetDir)).filter((entry) => entry.startsWith(".croco-stage-"));
}

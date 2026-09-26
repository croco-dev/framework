import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CANONICAL_TURBO_CACHE_TASKS,
  parseCanonicalCacheCli,
  pruneTurboCache,
  warmTurboCache,
} from "../turbo-canonical-cache.mts";
import { createFastPackageTurboArguments } from "../test-lane-runner.mts";
import { createVerificationManifest } from "../verification-manifest.mts";
import type { TurboCacheOptions } from "../turbo-canonical-cache.mts";

const ROOT_DIR = resolve(import.meta.dirname, "../..");
const CURRENT_HASH = "0123456789abcdef";
const CURRENT_PARTIAL_HASH = "1111111111111111";
const STALE_HASH = "aaaaaaaaaaaaaaaa";
const STALE_PARTIAL_HASH = "bbbbbbbbbbbbbbbb";

const FAKE_TURBO_SOURCE = `#!/usr/bin/env node
const { appendFileSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_TURBO_LOG, JSON.stringify(args) + "\\n");
if (args.includes("--dry=json")) {
  process.stdout.write(process.env.FAKE_TURBO_DRY_RUN_STDOUT ?? "");
  process.exit(Number(process.env.FAKE_TURBO_DRY_RUN_EXIT ?? "0"));
}
const attempt = readFileSync(process.env.FAKE_TURBO_LOG, "utf8").trim().split("\\n").length;
const outcome = (process.env.FAKE_TURBO_WARM_OUTCOMES ?? "").split(",")[attempt - 1];
const FAILED_TASK_BY_OUTCOME = { "build-failure": "build", "test-failure": "test:evidence" };
const failedTask = FAILED_TASK_BY_OUTCOME[outcome];
const runsDirectory = join(process.cwd(), ".turbo", "runs");
mkdirSync(runsDirectory, { recursive: true });
const summaryPath = join(runsDirectory, "attempt-" + attempt + ".json");
writeFileSync(
  summaryPath,
  JSON.stringify({
    tasks: ["build", "typecheck", "test:evidence"].map((task) => ({
      package: "@fixture/package",
      task,
      execution: { exitCode: task === failedTask ? 1 : 0 },
    })),
  }),
);
process.stdout.write("Summary: " + summaryPath + "\\n");
process.exit(failedTask ? 1 : 0);
`;

describe("turbo canonical cache", () => {
  let workspace!: string;
  let rootDir!: string;
  let cacheDir!: string;
  let turboBinary!: string;
  let turboLog!: string;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "croco-turbo-canonical-cache-"));
    rootDir = join(workspace, "repository");
    cacheDir = join(workspace, "cache");
    turboBinary = join(workspace, "bin", "turbo");
    turboLog = join(workspace, "turbo.log");
    mkdirSync(rootDir);
    mkdirSync(cacheDir);
    mkdirSync(join(workspace, "bin"));
    writeFileSync(turboBinary, FAKE_TURBO_SOURCE);
    chmodSync(turboBinary, 0o755);
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  function commitRepository(): void {
    writeFileSync(join(rootDir, "README.md"), "fixture\n");
    execFileSync("git", ["init", "--quiet"], { cwd: rootDir });
    execFileSync("git", ["add", "."], { cwd: rootDir });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=canonical-cache",
        "-c",
        "user.email=cache@example.invalid",
        "-c",
        "commit.gpgSign=false",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      ],
      { cwd: rootDir },
    );
  }

  function options(fakeEnvironment: Readonly<Record<string, string>> = {}): TurboCacheOptions {
    return {
      rootDir,
      cacheDir,
      tasks: CANONICAL_TURBO_CACHE_TASKS,
      env: { ...process.env, FAKE_TURBO_LOG: turboLog, ...fakeEnvironment },
      turboBinary,
    };
  }

  function turboInvocations(): readonly (readonly string[])[] {
    if (!existsSync(turboLog)) return [];
    return readFileSync(turboLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as readonly string[]);
  }

  function dryRunPlan(hashes: readonly string[]): string {
    return JSON.stringify({
      tasks: hashes.map((hash) => ({ taskId: `@fixture/a#${hash}`, hash })),
    });
  }

  function writeCacheEntries(names: readonly string[]): void {
    for (const name of names) writeFileSync(join(cacheDir, name), "cache\n");
  }

  function turboTasks(command: readonly string[]): readonly string[] {
    const turboIndex = command.indexOf("turbo");
    expect(turboIndex, command.join(" ")).toBeGreaterThanOrEqual(0);
    expect(command[turboIndex + 1]).toBe("run");
    const runArguments = command.slice(turboIndex + 2);
    const firstFlag = runArguments.findIndex((argument) => argument.startsWith("-"));
    return firstFlag === -1 ? runArguments : runArguments.slice(0, firstFlag);
  }

  describe("CLI arguments", () => {
    it.each([
      [[]],
      [["warm"]],
      [["warm", "--cache-dir"]],
      [["prune", "--cache-dir", "/tmp/cache"]],
      [["prune", "--hash-list", "/tmp/hashes.txt"]],
      [["prune", "--cache-dir", "--hash-list", "/tmp/hashes.txt"]],
    ])("rejects missing arguments %j with TURBO_CACHE_ARGUMENT_MISSING", (args) => {
      expect(() => parseCanonicalCacheCli(args)).toThrow(
        expect.objectContaining({ code: "TURBO_CACHE_ARGUMENT_MISSING", category: "input" }),
      );
    });

    it.each([
      [["clean", "--cache-dir", "/tmp/cache"]],
      [["warm", "--cache-dir", "/tmp/cache", "--hash-list", "/tmp/hashes.txt"]],
      [["prune", "--cache-dir", "/tmp/cache", "--hash-list", "/tmp/h.txt", "--force"]],
    ])("rejects unknown commands or options %j", (args) => {
      expect(() => parseCanonicalCacheCli(args)).toThrow(
        expect.objectContaining({ code: "TURBO_CACHE_ARGUMENT_INVALID", category: "input" }),
      );
    });

    it("reports a missing hash list from the CLI entrypoint with the stable code", () => {
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "scripts/turbo-canonical-cache.mts",
          "prune",
          "--cache-dir",
          cacheDir,
        ],
        { cwd: ROOT_DIR, encoding: "utf8" },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("[TURBO_CACHE_ARGUMENT_MISSING/input]");
    });

    it("binds warm and prune to the canonical tasks, repository turbo, and process environment", () => {
      const warm = parseCanonicalCacheCli(["warm", "--cache-dir", cacheDir]);
      const prune = parseCanonicalCacheCli([
        "prune",
        "--cache-dir",
        cacheDir,
        "--hash-list",
        join(workspace, "hashes.txt"),
      ]);

      expect(warm.options).toEqual({
        rootDir: ROOT_DIR,
        cacheDir,
        tasks: CANONICAL_TURBO_CACHE_TASKS,
        env: process.env,
        turboBinary: join(ROOT_DIR, "node_modules/.bin/turbo"),
      });
      expect(prune.options.tasks).toEqual(warm.options.tasks);
      expect(prune.options.env).toBe(warm.options.env);
      expect(prune).toMatchObject({ mode: "prune", hashListPath: join(workspace, "hashes.txt") });
    });
  });

  describe("drift guard", () => {
    it("covers exactly the turbo tasks run by the manifest build, typecheck, and fast test lane", () => {
      const manifest = createVerificationManifest("publish");
      const commandFor = (id: string): readonly string[] => {
        const command = manifest.find((candidate) => candidate.id === id)?.command;
        expect(command, `missing manifest check ${id}`).toBeDefined();
        return command ?? [];
      };
      const manifestTasks = new Set([
        ...turboTasks(commandFor("build")),
        ...turboTasks(commandFor("typecheck")),
        ...turboTasks(createFastPackageTurboArguments(ROOT_DIR, [])),
      ]);

      expect([...manifestTasks].sort()).toEqual([...CANONICAL_TURBO_CACHE_TASKS].sort());
    });

    it("warms without passthrough arguments that would change task hashes", async () => {
      const result = await warmTurboCache(options({ FAKE_TURBO_WARM_OUTCOMES: "success" }));

      expect(result).toEqual({ exitCode: 0, attempts: 1 });
      expect(turboInvocations()).toEqual([
        [
          "run",
          ...CANONICAL_TURBO_CACHE_TASKS,
          "--summarize",
          "--concurrency=4",
          "--continue=always",
          `--cache-dir=${cacheDir}`,
        ],
      ]);
      expect(turboInvocations()[0]).not.toContain("--");
    });

    it("keeps NODE_ENV, the only hashed environment variable, out of every workflow", () => {
      const workflowDirectory = resolve(ROOT_DIR, ".github/workflows");
      const workflows = readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/.test(name));
      const offenders = workflows.filter((name) =>
        /\bNODE_ENV\s*[:=]/.test(readFileSync(join(workflowDirectory, name), "utf8")),
      );

      expect(workflows.length).toBeGreaterThan(0);
      expect(offenders).toEqual([]);
    });
  });

  describe("warmTurboCache", () => {
    it("reruns once when the first run failed a build task", async () => {
      const result = await warmTurboCache(
        options({ FAKE_TURBO_WARM_OUTCOMES: "build-failure,success" }),
      );

      expect(result).toEqual({ exitCode: 0, attempts: 2 });
      expect(turboInvocations()).toHaveLength(2);
      expect(turboInvocations()[1]).toEqual(turboInvocations()[0]);
    });

    it("does not retry more than once when build tasks keep failing", async () => {
      const result = await warmTurboCache(
        options({ FAKE_TURBO_WARM_OUTCOMES: "build-failure,build-failure,success" }),
      );

      expect(result).toEqual({ exitCode: 1, attempts: 2 });
      expect(turboInvocations()).toHaveLength(2);
    });

    it("does not retry when only a non-build task failed", async () => {
      const result = await warmTurboCache(
        options({ FAKE_TURBO_WARM_OUTCOMES: "test-failure,success" }),
      );

      expect(result).toEqual({ exitCode: 1, attempts: 1 });
      expect(turboInvocations()).toHaveLength(1);
    });

    it("fails with a stable code when turbo cannot be started", async () => {
      await expect(
        warmTurboCache({ ...options(), turboBinary: join(workspace, "missing-turbo") }),
      ).rejects.toMatchObject({ code: "TURBO_CACHE_WARM_SPAWN_FAILED" });
    });
  });

  describe("pruneTurboCache", () => {
    it("fails before running turbo when the cache directory is missing", () => {
      commitRepository();

      expect(() =>
        pruneTurboCache({ ...options(), cacheDir: join(workspace, "missing-cache") }),
      ).toThrow(expect.objectContaining({ code: "TURBO_CACHE_DIR_MISSING" }));
      expect(turboInvocations()).toEqual([]);
    });

    it("lists every reported path when the worktree is dirty", () => {
      commitRepository();
      writeFileSync(join(rootDir, "README.md"), "changed\n");
      writeFileSync(join(rootDir, "untracked.txt"), "new\n");

      expect(() => pruneTurboCache(options())).toThrow(
        expect.objectContaining({
          code: "TURBO_CACHE_WORKTREE_DIRTY",
          message: expect.stringMatching(/README\.md, untracked\.txt$/),
        }),
      );
      expect(turboInvocations()).toEqual([]);
    });

    it("fails when git status cannot inspect the root directory", () => {
      expect(() => pruneTurboCache(options())).toThrow(
        expect.objectContaining({ code: "TURBO_CACHE_WORKTREE_STATUS_FAILED" }),
      );
      expect(turboInvocations()).toEqual([]);
    });

    it.each([
      ["a non-zero exit", { FAKE_TURBO_DRY_RUN_EXIT: "2", FAKE_TURBO_DRY_RUN_STDOUT: "" }],
      ["unparsable JSON", { FAKE_TURBO_DRY_RUN_STDOUT: "not json" }],
      ["a plan without tasks", { FAKE_TURBO_DRY_RUN_STDOUT: "{}" }],
      ["an invalid task hash", { FAKE_TURBO_DRY_RUN_STDOUT: dryRunPlan(["NOT-A-HASH"]) }],
    ])("fails when the dry run reports %s and keeps every entry", (_reason, fakeEnvironment) => {
      commitRepository();
      writeCacheEntries([`${STALE_HASH}.tar.zst`]);

      expect(() => pruneTurboCache(options(fakeEnvironment))).toThrow(
        expect.objectContaining({ code: "TURBO_CACHE_DRY_RUN_FAILED" }),
      );
      expect(readdirSync(cacheDir)).toEqual([`${STALE_HASH}.tar.zst`]);
    });

    it("runs the dry run for the requested tasks with the provided environment", () => {
      commitRepository();

      pruneTurboCache(options({ FAKE_TURBO_DRY_RUN_STDOUT: dryRunPlan([CURRENT_HASH]) }));

      expect(turboInvocations()).toEqual([["run", ...CANONICAL_TURBO_CACHE_TASKS, "--dry=json"]]);
    });

    it("rejects unexpected cache entries without deleting anything", () => {
      commitRepository();
      writeCacheEntries([`${STALE_HASH}.tar.zst`, "notes.txt"]);

      expect(() =>
        pruneTurboCache(options({ FAKE_TURBO_DRY_RUN_STDOUT: dryRunPlan([CURRENT_HASH]) })),
      ).toThrow(
        expect.objectContaining({
          code: "TURBO_CACHE_UNEXPECTED_ENTRY",
          message: expect.stringContaining("notes.txt"),
        }),
      );
      expect(readdirSync(cacheDir).sort()).toEqual([`${STALE_HASH}.tar.zst`, "notes.txt"]);
    });

    it("deletes stale and partial entries while keeping entries for current hashes", () => {
      commitRepository();
      writeCacheEntries([
        `${CURRENT_HASH}.tar.zst`,
        `${CURRENT_HASH}-meta.json`,
        `${CURRENT_PARTIAL_HASH}-meta.json`,
        `${STALE_HASH}.tar.zst`,
        `${STALE_HASH}-meta.json`,
        `${STALE_HASH}-manifest.json`,
        `${STALE_PARTIAL_HASH}-meta.json`,
      ]);

      const result = pruneTurboCache(
        options({
          FAKE_TURBO_DRY_RUN_STDOUT: dryRunPlan([
            CURRENT_PARTIAL_HASH,
            CURRENT_HASH,
            "2222222222222222",
          ]),
        }),
      );

      expect(result).toEqual({ keptHashes: [CURRENT_HASH, CURRENT_PARTIAL_HASH], removedCount: 4 });
      expect(readdirSync(cacheDir).sort()).toEqual([
        `${CURRENT_HASH}-meta.json`,
        `${CURRENT_HASH}.tar.zst`,
        `${CURRENT_PARTIAL_HASH}-meta.json`,
      ]);
    });
  });
});

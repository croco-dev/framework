import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createReleaseSpineEvidenceManifest,
  defaultCommandRunner,
  markReportInterrupted,
  parseArgs,
  runReleaseSpineEvidence,
} from "../release-spine-evidence.mts";
import type {
  Clock,
  CommandRunResult,
  CommandRunner,
  EvidenceArtifactExpectation,
  EvidenceCommand,
  ReleaseSpineEvidenceReport,
} from "../release-spine-evidence.mts";

const tempRepos: string[] = [];

describe("release-spine-evidence.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("defines the full release spine evidence manifest", () => {
    const manifest = createReleaseSpineEvidenceManifest();

    expect(manifest.map((check) => check.id)).toEqual([
      "build",
      "quick-start-lambda-smoke",
      "first-success",
      "package-entrypoints-smoke",
      "package-bins-smoke",
      "release-metadata",
      "generated-app-smoke",
      "alpha-release-smoke",
      "typecheck",
      "test",
      "provider-certification",
      "production-ready",
      "spine-promotion",
      "spine-bundle-size",
      "core-coverage",
      "core-coverage-warning",
      "public-api",
    ]);
    expect(findCheck(manifest, "production-ready").command).toEqual([
      "pnpm",
      "production-ready:check",
      "--",
      "--require-task-summaries",
    ]);
    expect(findCheck(manifest, "release-metadata").command).toEqual([
      "node",
      "--experimental-strip-types",
      "scripts/release-metadata-check.mts",
    ]);
    expect(
      findCheck(manifest, "generated-app-smoke").artifacts?.map((artifact) => artifact.path),
    ).toEqual(["ci-reports/generated-apps/matrix.md", "ci-reports/generated-apps/matrix.json"]);
    expect(findCheck(manifest, "alpha-release-smoke").command).toEqual([
      "pnpm",
      "alpha-release:smoke",
    ]);
    expect(
      findCheck(manifest, "alpha-release-smoke").artifacts?.map((artifact) => artifact.path),
    ).toEqual(["ci-reports/release/alpha-release-smoke.md"]);
    expect(findCheck(manifest, "spine-bundle-size").command).toEqual([
      "pnpm",
      "package-quality:report",
      "--",
      "--enforce-spine-bundle-size",
    ]);
    expect(
      findCheck(manifest, "spine-bundle-size").artifacts?.map((artifact) => artifact.path),
    ).toEqual([
      "ci-reports/package-quality/report.md",
      "ci-reports/package-quality/summary.json",
      "ci-reports/package-quality/bundle-size.md",
    ]);
    expect(manifest.findIndex((check) => check.id === "release-metadata")).toBeLessThan(
      manifest.findIndex((check) => check.id === "generated-app-smoke"),
    );
    expect(manifest.findIndex((check) => check.id === "generated-app-smoke")).toBeLessThan(
      manifest.findIndex((check) => check.id === "alpha-release-smoke"),
    );
    expect(manifest.findIndex((check) => check.id === "alpha-release-smoke")).toBeLessThan(
      manifest.findIndex((check) => check.id === "typecheck"),
    );
  });

  it("writes checkpointed markdown and JSON reports and copies required artifacts", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const sourceArtifact = join(repo, "ci-reports", "source", "provider.md");
    const checkpoints: ReleaseSpineEvidenceReport[] = [];
    const commands = [
      createCommand("provider-certification", {
        artifacts: [
          {
            label: "Provider report",
            path: "ci-reports/source/provider.md",
            required: true,
          },
        ],
      }),
    ];
    const runner: CommandRunner = () => {
      mkdirSync(join(repo, "ci-reports", "source"), { recursive: true });
      writeFileSync(sourceArtifact, "# provider\n");
      return okResult("provider ok");
    };

    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 1_000,
      commands,
      runner,
      onCheckpoint: (checkpoint) => checkpoints.push(checkpoint),
    });

    expect(report.status).toBe("passed");
    expect(checkpoints.map((checkpoint) => checkpoint.status)).toContain("running");
    expect(
      readJson<ReleaseSpineEvidenceReport>(join(outputDir, "spine-evidence.json")).status,
    ).toBe("passed");
    expect(readFileSync(join(outputDir, "spine-evidence.md"), "utf-8")).toContain(
      "# Release Spine Evidence",
    );
    expect(existsSync(join(outputDir, "artifacts", "provider-certification", "provider.md"))).toBe(
      true,
    );
  });

  it("fails a passing command when a required artifact is missing", async () => {
    const repo = createTempRepo();
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "release"),
      totalTimeoutMs: 1_000,
      commands: [
        createCommand("generated-app-smoke", {
          artifacts: [
            {
              label: "Generated app matrix",
              path: "ci-reports/generated-apps/matrix.md",
              required: true,
            },
          ],
        }),
      ],
      runner: () => okResult("generated app ok"),
    });

    expect(report.status).toBe("failed");
    expect(report.checks[0]?.status).toBe("failed");
    expect(report.checks[0]?.failureReason).toContain("Required release evidence artifact");
  });

  it("fails a passing command when a required artifact was not refreshed", async () => {
    const repo = createTempRepo();
    const artifactPath = join(repo, "ci-reports", "generated-apps", "matrix.md");
    const fakeTime = createFakeClock();
    fakeTime.advance(1_000);
    mkdirSync(join(repo, "ci-reports", "generated-apps"), { recursive: true });
    writeFileSync(artifactPath, "# stale matrix\n");
    utimesSync(artifactPath, new Date(0), new Date(0));

    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "release"),
      totalTimeoutMs: 1_000,
      commands: [
        createCommand("generated-app-smoke", {
          artifacts: [
            {
              label: "Generated app matrix",
              path: "ci-reports/generated-apps/matrix.md",
              required: true,
            },
          ],
        }),
      ],
      clock: fakeTime.clock,
      runner: () => okResult("generated app ok"),
    });

    expect(report.status).toBe("failed");
    expect(report.checks[0]?.artifacts[0]?.exists).toBe(true);
    expect(report.checks[0]?.artifacts[0]?.fresh).toBe(false);
    expect(report.checks[0]?.artifacts[0]?.copiedPath).toBeNull();
    expect(report.checks[0]?.failureReason).toContain("were not refreshed");
  });

  it("records failed command output with bounded excerpts", async () => {
    const repo = createTempRepo();
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "release"),
      totalTimeoutMs: 1_000,
      commands: [createCommand("release-metadata")],
      maxOutputExcerptLength: 12,
      runner: () => ({
        errorCode: null,
        errorMessage: null,
        signal: null,
        status: 2,
        stderr: "stderr: release metadata failed",
        stdout: "stdout: release metadata diagnostics",
        timedOut: false,
      }),
    });

    expect(report.status).toBe("failed");
    expect(report.checks[0]?.stdoutExcerpt).toContain("[truncated 24 chars]");
    expect(report.checks[0]?.stdoutExcerpt).toContain("diagnostics");
    expect(report.checks[0]?.stderrExcerpt).toContain("[truncated");
    expect(report.checks[0]?.stderrExcerpt).toContain("failed");
  });

  it("reports command failure reasons before missing artifact reasons", async () => {
    const repo = createTempRepo();
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "release"),
      totalTimeoutMs: 1_000,
      commands: [
        createCommand("release-metadata", {
          artifacts: [
            {
              label: "Release metadata",
              path: "ci-reports/release-metadata/report.md",
              required: true,
            },
          ],
        }),
      ],
      runner: () => ({
        errorCode: null,
        errorMessage: null,
        signal: null,
        status: 2,
        stderr: "",
        stdout: "",
        timedOut: false,
      }),
    });

    expect(report.status).toBe("failed");
    expect(report.checks[0]?.failureReason).toBe("Command exited with status 2.");
  });

  it("records command timeouts and skips remaining checks after total timeout exhaustion", async () => {
    const repo = createTempRepo();
    const fakeTime = createFakeClock();
    const runner: CommandRunner = (_command, context) => {
      expect(context.timeoutMs).toBe(50);
      fakeTime.advance(100);
      return {
        errorCode: "ETIMEDOUT",
        errorMessage: "spawn timed out",
        signal: null,
        status: null,
        stderr: "timeout",
        stdout: "",
        timedOut: true,
      };
    };

    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "release"),
      totalTimeoutMs: 50,
      commands: [createCommand("core-coverage"), createCommand("public-api")],
      clock: fakeTime.clock,
      runner,
    });

    expect(report.status).toBe("timed_out");
    expect(report.checks.map((check) => check.status)).toEqual([
      "timed_out",
      "skipped_after_timeout",
    ]);
  });

  it("marks running and pending checks interrupted for best-effort signal reports", async () => {
    const repo = createTempRepo();
    let pendingReport: ReleaseSpineEvidenceReport | null = null;
    let runningReport: ReleaseSpineEvidenceReport | null = null;

    await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "release"),
      totalTimeoutMs: 1_000,
      commands: [createCommand("build"), createCommand("test")],
      runner: () => okResult("ok"),
      onCheckpoint: (checkpoint) => {
        if (!pendingReport && checkpoint.checks.every((check) => check.status === "pending")) {
          pendingReport = checkpoint;
        }
        if (!runningReport && checkpoint.checks.some((check) => check.status === "running")) {
          runningReport = checkpoint;
        }
      },
    });

    expect(pendingReport).not.toBeNull();
    expect(runningReport).not.toBeNull();
    const earlyInterrupted = markReportInterrupted(
      pendingReport ?? failMissingInterruptReport(),
      "SIGINT",
      "2026-01-01T00:00:00.000Z",
    );
    const interrupted = markReportInterrupted(
      runningReport ?? failMissingInterruptReport(),
      "SIGTERM",
      "2026-01-01T00:00:00.000Z",
    );

    expect(earlyInterrupted.status).toBe("interrupted");
    expect(earlyInterrupted.checks.map((check) => check.status)).toEqual([
      "interrupted",
      "interrupted",
    ]);
    expect(interrupted.status).toBe("interrupted");
    expect(interrupted.checks.map((check) => check.status)).toEqual(["interrupted", "interrupted"]);
  });

  it("runs real commands through the default async runner", async () => {
    const repo = createTempRepo();

    const result = await defaultCommandRunner(
      {
        id: "node-output",
        label: "Node output",
        category: "quality",
        command: [process.execPath, "-e", "console.log('runner ok')"],
        timeoutMs: 1_000,
      },
      {
        cwd: repo,
        timeoutMs: 1_000,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("runner ok");
    expect(result.timedOut).toBe(false);
  });

  it("times out real commands through the default async runner", async () => {
    const repo = createTempRepo();

    const result = await defaultCommandRunner(
      {
        id: "slow-node",
        label: "Slow Node",
        category: "quality",
        command: [process.execPath, "-e", "setTimeout(() => undefined, 10_000)"],
        timeoutMs: 50,
      },
      {
        cwd: repo,
        timeoutMs: 50,
      },
    );

    expect(result.status).toBeNull();
    expect(result.signal).toBe("SIGTERM");
    expect(result.timedOut).toBe(true);
  });

  it("parses root, output, and timeout options after the pnpm separator", () => {
    const repo = createTempRepo();
    const options = parseArgs([
      "--",
      "--root",
      repo,
      "--output-dir",
      "ci-reports/custom-release",
      "--total-timeout-ms",
      "25",
    ]);

    expect(options.rootDir).toBe(repo);
    expect(options.outputDir).toBe(resolve("ci-reports/custom-release"));
    expect(options.totalTimeoutMs).toBe(25);
  });

  it("preserves explicit output options when root is parsed later", () => {
    const repo = createTempRepo();
    const outputDir = "ci-reports/custom-release";
    const options = parseArgs(["--output-dir", outputDir, "--root", repo]);

    expect(options.rootDir).toBe(repo);
    expect(options.outputDir).toBe(resolve(outputDir));
  });

  it("rejects partial numeric timeout option values", () => {
    expect(() => parseArgs(["--total-timeout-ms", "25ms"])).toThrow(
      "--total-timeout-ms must be a positive integer",
    );
  });

  it("wires the root package script", () => {
    const packageJson = readJson(join(__dirname, "../../package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["release:spine-evidence"]).toBe(
      "node --experimental-strip-types scripts/release-spine-evidence.mts",
    );
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-release-spine-evidence-"));
  tempRepos.push(repo);
  return repo;
}

function createCommand(
  id: string,
  options: {
    readonly artifacts?: readonly EvidenceArtifactExpectation[];
    readonly timeoutMs?: number;
  } = {},
): EvidenceCommand {
  return {
    id,
    label: id,
    category: "quality",
    command: ["fake", id],
    timeoutMs: options.timeoutMs ?? 100,
    artifacts: options.artifacts,
  };
}

function okResult(stdout: string): CommandRunResult {
  return {
    errorCode: null,
    errorMessage: null,
    signal: null,
    status: 0,
    stderr: "",
    stdout,
    timedOut: false,
  };
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function findCheck(manifest: readonly EvidenceCommand[], id: string): EvidenceCommand {
  const check = manifest.find((entry) => entry.id === id);
  if (!check) {
    throw new Error(`Missing manifest check ${id}`);
  }
  return check;
}

function createFakeClock(): {
  readonly advance: (ms: number) => void;
  readonly clock: Clock;
} {
  let currentMs = 0;
  return {
    advance: (ms: number) => {
      currentMs += ms;
    },
    clock: {
      nowIso: () => new Date(currentMs).toISOString(),
      nowMs: () => currentMs,
    },
  };
}

function failMissingInterruptReport(): never {
  throw new Error("Missing interrupt checkpoint report");
}

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createGeneratedSmokeJourneyReport,
  writeGeneratedSmokeJourneyBundle,
  type GeneratedSmokeJourneySourceReport,
} from "../create-croco-app-generated-smoke-journey-report.mts";
import {
  createReleaseSpineEvidenceManifest,
  defaultCommandRunner,
  failedCheckDiagnostics,
  interruptActiveCommand,
  markReportInterrupted,
  parseArgs,
  runReleaseSpineEvidence,
} from "../release-spine-evidence.mts";
import { createVerificationManifest } from "../verification-manifest.mts";
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
    const publishManifest = createVerificationManifest("publish");

    expect(manifest[0]?.id).toBe("verification-policy");
    expect(manifest.at(-1)?.id).toBe("public-api");
    expect(findCheck(manifest, "changeset-required").applicable).toBe(false);
    expect(findCheck(manifest, "production-ready").command).toEqual([
      "node",
      "--experimental-strip-types",
      "scripts/tracked-file-mutation-guard.mts",
      "--recovery",
      "Fix the reported production-ready package violations",
      "--",
      "node",
      "--experimental-strip-types",
      "scripts/production-ready-check.mts",
      "--require-task-summaries",
    ]);
    expect(findCheck(publishManifest, "release-metadata").command).toEqual([
      "node",
      "--experimental-strip-types",
      "scripts/release-metadata-check.mts",
    ]);
    expect(
      findCheck(manifest, "generated-app-smoke").artifacts?.map((artifact) => artifact.path),
    ).toEqual([
      "ci-reports/generated-apps/spine-blocking-matrix.md",
      "ci-reports/generated-apps/spine-blocking-matrix.json",
      "ci-reports/generated-apps/spine-blocking-journeys",
    ]);
    expect(findCheck(manifest, "generated-app-smoke").command).toEqual([
      "node",
      "--experimental-strip-types",
      "scripts/create-croco-app-generated-smoke.mts",
      "--tier",
      "spine-blocking",
    ]);
    expect(
      findCheck(manifest, "alpha-release-smoke").artifacts?.map((artifact) => artifact.path),
    ).toEqual(["ci-reports/release/alpha-release-smoke.md"]);
    expect(
      findCheck(publishManifest, "spine-bundle-size").artifacts?.map((artifact) => artifact.path),
    ).toEqual([
      "ci-reports/package-quality/report.md",
      "ci-reports/package-quality/summary.json",
      "ci-reports/package-quality/bundle-size.md",
    ]);
    expect(manifest.findIndex((check) => check.id === "format")).toBeLessThan(
      manifest.findIndex((check) => check.id === "build"),
    );
  });

  it("writes checkpointed markdown and JSON reports and copies required artifacts", async () => {
    const repo = createTempRepo();
    const fakeTime = createFakeClock();
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
      clock: fakeTime.clock,
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

  it("derives the publish manifest for programmatic runs when commands are omitted", async () => {
    const repo = createTempRepo();
    const calledIds: string[] = [];
    const calledCommands: EvidenceCommand[] = [];
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "verification", "publish"),
      totalTimeoutMs: 10_000,
      profile: "publish",
      base: "origin/trunk",
      changedFiles: [],
      head: "HEAD",
      runner: (command) => {
        calledIds.push(command.id);
        calledCommands.push(command);
        return okResult(command.id);
      },
    });

    expect(report.profile).toBe("publish");
    expect(calledIds).toContain("dependency-audit-policy");
    expect(calledIds).toContain("provenance-config");
    expect(calledIds.at(-1)).toBe("publish-dry-run");
    expect(findCheck(calledCommands, "changeset-required").command).toContain("origin/trunk");
    expect(report.checks.map(({ id }) => id).at(-1)).toBe("publish-dry-run");
  });

  it.each([
    ["scripts/release-metadata-check.mts", "release-metadata"],
    ["scripts/package-quality-report.mts", "spine-bundle-size"],
  ])("executes and fails changed publish verifier %s", async (changedFile, failingId) => {
    const repo = createTempRepo();
    const calledIds: string[] = [];
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir: join(repo, "ci-reports", "verification", "publish"),
      totalTimeoutMs: 10_000,
      profile: "publish",
      base: "origin/trunk",
      changedFiles: [changedFile],
      head: "HEAD",
      runner: (command) => {
        calledIds.push(command.id);
        return command.id === failingId
          ? { ...okResult(command.id), status: 2 }
          : okResult(command.id);
      },
    });

    expect(calledIds).toContain(failingId);
    expect(findCheck(report.checks, failingId)).toMatchObject({ status: "failed" });
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
              label: "Spine-blocking generated app matrix",
              path: "ci-reports/generated-apps/spine-blocking-matrix.md",
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
    expect(failedCheckDiagnostics(report)).toEqual([
      expect.stringContaining("generated-app-smoke: failed: Required release evidence artifact"),
    ]);
  });

  it("preserves journey report relative links when copying release evidence", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const journeyRoot = join(repo, "ci-reports", "generated-apps", "spine-blocking-journeys");
    const generatedAppsRoot = join(repo, "ci-reports", "generated-apps");
    const sourceArtifactRelativePath =
      "artifacts/production-app-starter/contract-graph.snapshot.json";
    const sourceArtifactPath = join(generatedAppsRoot, sourceArtifactRelativePath);
    const failureArtifactPaths = [
      "cases/production-app-starter/stdout.log",
      "cases/production-app-starter/stderr.log",
      "cases/production-app-starter/files/.croco/diagnostic.json",
    ];
    const sourceReport = createReleaseJourneySourceReport(sourceArtifactRelativePath);
    const productionCase = sourceReport.cases[0];
    if (!productionCase) {
      throw new Error("missing production-app-starter release fixture");
    }
    const journeyReport = createGeneratedSmokeJourneyReport(
      {
        ...sourceReport,
        status: "failed",
        failure: "production app failed after collecting evidence",
        cases: [
          {
            ...productionCase,
            status: "failed",
            error: "production app failed after collecting evidence",
            artifactBundle: {
              stdoutPath: `ci-reports/generated-apps/${failureArtifactPaths[0]}`,
              stderrPath: `ci-reports/generated-apps/${failureArtifactPaths[1]}`,
              files: [`ci-reports/generated-apps/${failureArtifactPaths[2]}`],
            },
          },
          ...sourceReport.cases.slice(1),
        ],
      },
      ["production-app-starter", "graphql-lambda-api", "rest-spa-contracts"],
      undefined,
      "ci-reports/generated-apps",
    );
    const runner: CommandRunner = () => {
      mkdirSync(dirname(sourceArtifactPath), { recursive: true });
      writeFileSync(sourceArtifactPath, '{"status":"passed"}\n');
      for (const failureArtifactPath of failureArtifactPaths) {
        const absolutePath = join(generatedAppsRoot, failureArtifactPath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, `${failureArtifactPath}\n`);
      }
      writeGeneratedSmokeJourneyBundle(journeyRoot, journeyReport, generatedAppsRoot);
      return okResult("generated app ok");
    };

    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 1_000,
      commands: [
        createCommand("generated-app-smoke", {
          artifacts: [
            {
              label: "Journey bundle",
              path: "ci-reports/generated-apps/spine-blocking-journeys",
              required: true,
              copyRelativePath: "spine-blocking-journeys",
            },
          ],
        }),
      ],
      runner,
    });

    const copiedJourneyRoot = join(
      outputDir,
      "artifacts",
      "generated-app-smoke",
      "spine-blocking-journeys",
    );
    expect(report.status).toBe("passed");
    for (const journey of journeyReport.journeys) {
      for (const artifact of journey.artifacts) {
        expect(readFileSync(join(copiedJourneyRoot, "report.md"), "utf8")).toContain(
          `(${artifact})`,
        );
        expect(existsSync(join(copiedJourneyRoot, artifact))).toBe(true);
      }
    }
  });

  it("fails a passing command when a required artifact was not refreshed", async () => {
    const repo = createTempRepo();
    const artifactPath = join(repo, "ci-reports", "generated-apps", "spine-blocking-matrix.md");
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
              label: "Spine-blocking generated app matrix",
              path: "ci-reports/generated-apps/spine-blocking-matrix.md",
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
    const outputDir = join(repo, "ci-reports", "release");
    const outputRoot = join(outputDir, "artifacts", "release-metadata");
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(join(outputRoot, "stdout.log"), "stale stdout");
    writeFileSync(join(outputRoot, "stderr.log"), "stale stderr");
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
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
    expect(
      readFileSync(join(outputDir, "artifacts", "release-metadata", "stdout.log"), "utf8"),
    ).toBe("stdout: release metadata diagnostics");
    expect(
      readFileSync(join(outputDir, "artifacts", "release-metadata", "stderr.log"), "utf8"),
    ).toBe("stderr: release metadata failed");
    expect(report.checks[0]?.artifacts.map(({ copiedPath }) => copiedPath)).toEqual([
      "ci-reports/release/artifacts/release-metadata/stdout.log",
      "ci-reports/release/artifacts/release-metadata/stderr.log",
    ]);
    expect(readFileSync(join(outputDir, "spine-evidence.md"), "utf8")).toContain(
      "artifacts/release-metadata/stdout.log",
    );
  });

  it("contains a rejected runner and continues writing the final report", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 1_000,
      commands: [createCommand("rejected"), createCommand("continued")],
      runner: (check) => {
        if (check.id === "rejected") {
          throw new Error("runner rejected");
        }
        return okResult("continued");
      },
    });

    expect(report.status).toBe("failed");
    expect(report.checks.map(({ status }) => status)).toEqual(["failed", "passed"]);
    expect(report.checks[0]?.errorMessage).toBe("runner rejected");
    expect(readJson<ReleaseSpineEvidenceReport>(join(outputDir, "spine-evidence.json"))).toEqual(
      report,
    );
  });

  it("preserves complete real command output beyond the in-memory buffer", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const stdout = "full stdout survives the bounded buffer";
    const stderr = "full stderr survives the bounded buffer";
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 10_000,
      commands: [
        createCommand("real-failure", {
          command: [
            process.execPath,
            "-e",
            `process.stdout.write(${JSON.stringify(stdout)}); process.stderr.write(${JSON.stringify(stderr)}); process.exit(7)`,
          ],
          timeoutMs: 5_000,
        }),
      ],
      maxCommandOutputBufferLength: 8,
    });

    expect(report.status).toBe("failed");
    expect(report.checks[0]?.stdoutExcerpt).toBe(stdout.slice(-8));
    expect(report.checks[0]?.stderrExcerpt).toBe(stderr.slice(-8));
    expect(readFileSync(join(outputDir, "artifacts", "real-failure", "stdout.log"), "utf8")).toBe(
      stdout,
    );
    expect(readFileSync(join(outputDir, "artifacts", "real-failure", "stderr.log"), "utf8")).toBe(
      stderr,
    );
    expect(report.checks[0]?.artifacts.map(({ copiedPath }) => copiedPath)).toEqual([
      "ci-reports/release/artifacts/real-failure/stdout.log",
      "ci-reports/release/artifacts/real-failure/stderr.log",
    ]);
  });

  it("removes streamed command output after a successful check", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 10_000,
      commands: [
        createCommand("real-success", {
          command: [process.execPath, "-e", "console.log('success')"],
          timeoutMs: 5_000,
        }),
      ],
    });

    expect(report.status).toBe("passed");
    expect(existsSync(join(outputDir, "artifacts", "real-success", "stdout.log"))).toBe(false);
    expect(existsSync(join(outputDir, "artifacts", "real-success", "stderr.log"))).toBe(false);
  });

  it("records command-output cleanup failures without aborting the final report", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 1_000,
      commands: [createCommand("cleanup-failure")],
      runner: (_check, context) => {
        if (!context.stdoutPath) {
          throw new Error("stdout path is required");
        }
        mkdirSync(context.stdoutPath, { recursive: true });
        writeFileSync(join(context.stdoutPath, "retained.log"), "cleanup blocked");
        return okResult("ok");
      },
    });

    expect(report.status).toBe("failed");
    expect(report.checks[0]?.status).toBe("failed");
    expect(report.checks[0]?.errorCode).toBe("COMMAND_OUTPUT_CLEANUP_FAILED");
    expect(report.checks[0]?.failureReason).toContain("stdout.log");
    expect(report.checks[0]?.artifacts.map(({ label }) => label)).toEqual([
      "Command stdout (bounded fallback; may be truncated)",
      "Command stderr (bounded fallback; may be truncated)",
    ]);
    expect(existsSync(join(outputDir, "spine-evidence.json"))).toBe(true);
  });

  it("finalizes real command evidence before reporting an interruption", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const readyPath = join(repo, "interrupted-command.ready");
    let interruptSignal: NodeJS.Signals | null = null;
    const reportPromise = runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 15_000,
      commands: [
        createCommand("interrupted-command", {
          command: [
            process.execPath,
            "-e",
            `process.on("SIGTERM", () => undefined); process.stdout.write("partial output"); require("node:fs").writeFileSync(${JSON.stringify(readyPath)}, "ready"); setInterval(() => undefined, 10_000)`,
          ],
          timeoutMs: 10_000,
        }),
        createCommand("not-started"),
      ],
      getInterruptSignal: () => interruptSignal,
    });
    await waitForPath(readyPath);
    interruptSignal = "SIGTERM";
    interruptActiveCommand(interruptSignal, 50);
    const report = await reportPromise;

    expect(report.status).toBe("interrupted");
    expect(report.checks.map(({ status }) => status)).toEqual(["interrupted", "interrupted"]);
    expect(report.checks[0]?.signal).toBe("SIGTERM");
    expect(
      readFileSync(join(outputDir, "artifacts", "interrupted-command", "stdout.log"), "utf8"),
    ).toBe("partial output");
    expect(report.checks[0]?.artifacts.map(({ copiedPath }) => copiedPath)).toEqual([
      "ci-reports/release/artifacts/interrupted-command/stdout.log",
      "ci-reports/release/artifacts/interrupted-command/stderr.log",
    ]);
  });

  it("fails spine and publish execution on the same broken shared command ID", async () => {
    for (const profile of ["spine", "publish"] as const) {
      const sharedCommand = createVerificationManifest(profile).find(({ id }) => id === "build");
      expect(sharedCommand).toBeDefined();

      const repo = createTempRepo();
      const report = await runReleaseSpineEvidence({
        rootDir: repo,
        outputDir: join(repo, "ci-reports", profile),
        totalTimeoutMs: 1_000,
        profile,
        commands: sharedCommand ? [sharedCommand] : [],
        runner: () => ({
          errorCode: null,
          errorMessage: null,
          signal: null,
          status: 2,
          stderr: "shared build gate failed",
          stdout: "",
          timedOut: false,
        }),
      });

      expect(report.status).toBe("failed");
      expect(report.checks[0]).toMatchObject({ id: "build", status: "failed" });
    }
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
    const stdoutPath = join(repo, "command-output", "stdout.log");
    const stderrPath = join(repo, "command-output", "stderr.log");

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
        stderrPath,
        stdoutPath,
        timeoutMs: 1_000,
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("runner ok");
    expect(readFileSync(stdoutPath, "utf8")).toBe("runner ok\n");
    expect(readFileSync(stderrPath, "utf8")).toBe("");
    expect(result.timedOut).toBe(false);
  });

  it("reports command output open failures without rejecting", async () => {
    const repo = createTempRepo();
    const blockedOutputRoot = join(repo, "blocked-output");
    writeFileSync(blockedOutputRoot, "not a directory");

    const result = await defaultCommandRunner(
      {
        id: "blocked-output",
        label: "Blocked output",
        category: "quality",
        command: [process.execPath, "-e", "console.log('not started')"],
        timeoutMs: 1_000,
      },
      {
        cwd: repo,
        stdoutPath: join(blockedOutputRoot, "stdout.log"),
        timeoutMs: 1_000,
      },
    );

    expect(result.status).toBeNull();
    expect(result.errorMessage).toContain("Failed to persist command stdout");
    expect(result.stdoutFileComplete).toBe(false);
  });

  it("reports command output write failures without throwing", async () => {
    const repo = createTempRepo();
    const outputRoot = join(repo, "command-output");
    const outputError = Object.assign(new Error("disk full"), { code: "ENOSPC" });

    const result = await defaultCommandRunner(
      {
        id: "failed-output-write",
        label: "Failed output write",
        category: "quality",
        command: [process.execPath, "-e", "process.stdout.write('diagnostics')"],
        timeoutMs: 1_000,
      },
      {
        cwd: repo,
        stderrPath: join(outputRoot, "stderr.log"),
        stdoutPath: join(outputRoot, "stdout.log"),
        timeoutMs: 1_000,
        writeOutput: () => {
          throw outputError;
        },
      },
    );

    expect(result.status).toBeNull();
    expect(result.errorCode).toBe("ENOSPC");
    expect(result.errorMessage).toContain("Failed to persist command stdout: disk full");
    expect(result.stdoutFileComplete).toBe(false);
  });

  it("keeps the complete sibling stream when one output stream fails", async () => {
    const repo = createTempRepo();
    const outputDir = join(repo, "ci-reports", "release");
    const stdout = "o".repeat(100);
    const stderr = "s".repeat(100);
    const report = await runReleaseSpineEvidence({
      rootDir: repo,
      outputDir,
      totalTimeoutMs: 5_000,
      commands: [
        createCommand("partial-output-failure", {
          command: [
            process.execPath,
            "-e",
            `process.stderr.write(${JSON.stringify(stderr)}); process.stdout.write(${JSON.stringify(stdout)})`,
          ],
          timeoutMs: 2_000,
        }),
      ],
      commandOutputWriter: (descriptor, output, offset, length) => {
        const text = Buffer.from(output)
          .subarray(offset, offset + length)
          .toString("utf8");
        if (/^o+$/.test(text)) {
          throw Object.assign(new Error("stdout disk full"), { code: "ENOSPC" });
        }
        return writeSync(descriptor, output, offset, length);
      },
      maxCommandOutputBufferLength: 8,
    });

    expect(report.status).toBe("failed");
    expect(
      readFileSync(join(outputDir, "artifacts", "partial-output-failure", "stdout.log"), "utf8"),
    ).toBe(stdout.slice(-8));
    expect(
      readFileSync(join(outputDir, "artifacts", "partial-output-failure", "stderr.log"), "utf8"),
    ).toBe(stderr);
    expect(report.checks[0]?.artifacts.map(({ fresh }) => fresh)).toEqual([true, true]);
    expect(report.checks[0]?.artifacts.map(({ label }) => label)).toEqual([
      "Command stdout (bounded fallback; may be truncated)",
      "Command stderr",
    ]);
  });

  it("retries short command-output writes until the full buffer is persisted", async () => {
    const repo = createTempRepo();
    const stdoutPath = join(repo, "command-output", "stdout.log");
    let writeCalls = 0;
    const result = await defaultCommandRunner(
      {
        id: "short-output-write",
        label: "Short output write",
        category: "quality",
        command: [process.execPath, "-e", "process.stdout.write('complete diagnostics')"],
        timeoutMs: 1_000,
      },
      {
        cwd: repo,
        stdoutPath,
        timeoutMs: 1_000,
        writeOutput: (descriptor, output, offset) => {
          writeCalls++;
          return writeSync(descriptor, output, offset, 1);
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdoutFileComplete).toBe(true);
    expect(writeCalls).toBeGreaterThan(1);
    expect(readFileSync(stdoutPath, "utf8")).toBe("complete diagnostics");
  });

  it("times out real commands through the default async runner", async () => {
    const repo = createTempRepo();
    const stdoutPath = join(repo, "command-output", "stdout.log");
    const stderrPath = join(repo, "command-output", "stderr.log");

    const result = await defaultCommandRunner(
      {
        id: "slow-node",
        label: "Slow Node",
        category: "quality",
        command: [
          process.execPath,
          "-e",
          "process.stdout.write('before timeout'); setTimeout(() => undefined, 10_000)",
        ],
        timeoutMs: 200,
      },
      {
        cwd: repo,
        stderrPath,
        stdoutPath,
        timeoutMs: 200,
      },
    );

    expect(result.status).toBeNull();
    expect(result.signal).toBe("SIGTERM");
    expect(result.timedOut).toBe(true);
    expect(readFileSync(stdoutPath, "utf8")).toBe("before timeout");
    expect(readFileSync(stderrPath, "utf8")).toBe("");
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

  it("enables pending release metadata only through the explicit option", () => {
    expect(parseArgs([]).allowPendingReleaseMetadata).toBe(false);
    expect(parseArgs(["--allow-pending-release-metadata"]).allowPendingReleaseMetadata).toBe(true);
  });

  it("rejects profile overrides after a profile alias has selected one", () => {
    expect(() => parseArgs(["--profile", "publish", "--", "--profile", "repo"])).toThrow(
      "--profile may be provided only once",
    );
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

    expect(packageJson.scripts?.["release:spine-evidence"]).toBe("pnpm verify:spine");
  });
});

function createReleaseJourneySourceReport(
  contractArtifactPath: string,
): GeneratedSmokeJourneySourceReport {
  const step = (
    label: string,
    options: { readonly artifact?: string; readonly diagnosticCodes?: readonly string[] } = {},
  ) => ({
    label,
    command: `pnpm ${label.toLowerCase().replaceAll(" ", ":")}`,
    artifacts: options.artifact ? [{ reportRelativePath: options.artifact }] : [],
    status: "passed" as const,
    diagnosticCodes: options.diagnosticCodes ?? [],
  });

  return {
    generatedAt: "2026-07-11T00:00:00.000Z",
    status: "passed",
    gates: [],
    cases: [
      {
        name: "production-app-starter",
        status: "passed",
        recovery: { localRerunCommand: "pnpm create-croco-app:smoke production-app-starter" },
        steps: [
          step("generate"),
          step("install"),
          step("dev smoke"),
          step("Contract snapshot", { artifact: contractArtifactPath }),
          step("Contract coverage"),
          step("Contract diff"),
          step("OpenAPI contract"),
          step("RPC client"),
          step("DI graph verify"),
        ],
      },
      {
        name: "graphql-lambda-api",
        status: "passed",
        recovery: { localRerunCommand: "pnpm create-croco-app:smoke graphql-lambda-api" },
        steps: [step("protected GraphQL route smoke")],
      },
      {
        name: "rest-spa-contracts",
        status: "passed",
        recovery: { localRerunCommand: "pnpm create-croco-app:smoke rest-spa-contracts" },
        steps: [
          step("strict Problem declaration canary", {
            diagnosticCodes: ["contract-route-missing-problem-response-contract"],
          }),
          step("strict OpenAPI schema canary"),
          step("strict RPC schema canary"),
        ],
      },
    ],
  };
}

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-release-spine-evidence-"));
  tempRepos.push(repo);
  return repo;
}

function createCommand(
  id: string,
  options: {
    readonly artifacts?: readonly EvidenceArtifactExpectation[];
    readonly command?: readonly string[];
    readonly timeoutMs?: number;
  } = {},
): EvidenceCommand {
  return {
    id,
    label: id,
    category: "quality",
    command: options.command ?? ["fake", id],
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

async function waitForPath(path: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${path}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
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

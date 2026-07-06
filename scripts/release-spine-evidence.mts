#!/usr/bin/env node

import { spawn, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultOutputDirectory = join("ci-reports", "release");
const reportMarkdownFileName = "spine-evidence.md";
const reportJsonFileName = "spine-evidence.json";
const releaseArtifactDirectory = "artifacts";
const defaultTotalTimeoutMs = 150 * 60 * 1000;
const defaultOutputExcerptLength = 4_000;
const commandOutputMaxBuffer = 50 * 1024 * 1024;
const commandTimeoutKillGraceMs = 5_000;

type EvidenceCategory =
  | "build"
  | "coverage"
  | "generated-app"
  | "metadata"
  | "package-smoke"
  | "public-api"
  | "quality"
  | "runtime-smoke"
  | "typecheck";

export type EvidenceStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "timed_out"
  | "interrupted"
  | "skipped_after_timeout";

export type EvidenceArtifactExpectation = {
  readonly label: string;
  readonly path: string;
  readonly required: boolean;
};

export type EvidenceArtifactReference = EvidenceArtifactExpectation & {
  readonly copiedPath: string | null;
  readonly copyError: string | null;
  readonly exists: boolean;
  readonly fresh: boolean;
  readonly modifiedAt: string | null;
  readonly sourcePath: string;
};

export type EvidenceCommand = {
  readonly id: string;
  readonly label: string;
  readonly category: EvidenceCategory;
  readonly command: readonly string[];
  readonly timeoutMs: number;
  readonly artifacts?: readonly EvidenceArtifactExpectation[];
};

export type EvidenceCheckResult = Omit<EvidenceCommand, "artifacts"> & {
  readonly artifacts: readonly EvidenceArtifactReference[];
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly effectiveTimeoutMs: number | null;
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly exitCode: number | null;
  readonly failureReason: string | null;
  readonly signal: string | null;
  readonly startedAt: string | null;
  readonly status: EvidenceStatus;
  readonly stderrExcerpt: string;
  readonly stdoutExcerpt: string;
};

export type ReleaseSpineEvidenceReport = {
  readonly schemaVersion: 1;
  readonly completedAt: string | null;
  readonly generatedAt: string;
  readonly outputDir: string;
  readonly rootDir: string;
  readonly status: "running" | "passed" | "failed" | "timed_out" | "interrupted";
  readonly summary: {
    readonly failed: number;
    readonly interrupted: number;
    readonly passed: number;
    readonly pending: number;
    readonly running: number;
    readonly skippedAfterTimeout: number;
    readonly timedOut: number;
    readonly total: number;
  };
  readonly totalTimeoutMs: number;
  readonly checks: readonly EvidenceCheckResult[];
};

export type CommandRunResult = {
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  readonly signal: string | null;
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
  readonly timedOut: boolean;
};

export type CommandRunner = (
  command: EvidenceCommand,
  context: {
    readonly cwd: string;
    readonly timeoutMs: number;
  },
) => CommandRunResult | Promise<CommandRunResult>;

export type Clock = {
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

type Options = {
  readonly rootDir: string;
  readonly outputDir: string;
  readonly totalTimeoutMs: number;
};

type RunOptions = Options & {
  readonly clock?: Clock;
  readonly commands?: readonly EvidenceCommand[];
  readonly maxOutputExcerptLength?: number;
  readonly onCheckpoint?: (report: ReleaseSpineEvidenceReport) => void;
  readonly runner?: CommandRunner;
};

const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};
let activeCommandProcess: ChildProcess | null = null;

function minutes(value: number): number {
  return value * 60 * 1000;
}

export function createReleaseSpineEvidenceManifest(): readonly EvidenceCommand[] {
  return [
    {
      id: "build",
      label: "Summarized build",
      category: "build",
      command: ["pnpm", "turbo", "run", "build", "--summarize", "--continue=always"],
      timeoutMs: minutes(30),
    },
    {
      id: "quick-start-lambda-smoke",
      label: "Quick-start Lambda smoke",
      category: "runtime-smoke",
      command: ["pnpm", "quick-start-lambda:smoke"],
      timeoutMs: minutes(10),
    },
    {
      id: "first-success",
      label: "First-success contract",
      category: "generated-app",
      command: ["pnpm", "first-success:verify"],
      timeoutMs: minutes(10),
    },
    {
      id: "package-entrypoints-smoke",
      label: "Package entrypoint smoke",
      category: "package-smoke",
      command: ["pnpm", "package-entrypoints:smoke"],
      timeoutMs: minutes(10),
    },
    {
      id: "package-bins-smoke",
      label: "Package binary smoke",
      category: "package-smoke",
      command: ["pnpm", "package-bins:smoke"],
      timeoutMs: minutes(20),
    },
    {
      id: "release-metadata",
      label: "Release metadata",
      category: "metadata",
      command: ["node", "--experimental-strip-types", "scripts/release-metadata-check.mts"],
      timeoutMs: minutes(10),
    },
    {
      id: "generated-app-smoke",
      label: "create-croco-app generated app smoke",
      category: "generated-app",
      command: ["pnpm", "create-croco-app:smoke"],
      timeoutMs: minutes(45),
      artifacts: [
        {
          label: "Generated app smoke matrix markdown",
          path: "ci-reports/generated-apps/matrix.md",
          required: true,
        },
        {
          label: "Generated app smoke matrix JSON",
          path: "ci-reports/generated-apps/matrix.json",
          required: true,
        },
      ],
    },
    {
      id: "alpha-release-smoke",
      label: "Packed generated app release smoke",
      category: "generated-app",
      command: ["pnpm", "alpha-release:smoke"],
      timeoutMs: minutes(45),
      artifacts: [
        {
          label: "Packed generated app smoke report",
          path: "ci-reports/release/alpha-release-smoke.md",
          required: true,
        },
      ],
    },
    {
      id: "typecheck",
      label: "Summarized TypeScript check",
      category: "typecheck",
      command: ["pnpm", "turbo", "run", "typecheck", "--summarize", "--continue=always"],
      timeoutMs: minutes(30),
    },
    {
      id: "test",
      label: "Summarized tests",
      category: "quality",
      command: ["pnpm", "turbo", "run", "test", "--summarize", "--continue=always"],
      timeoutMs: minutes(45),
    },
    {
      id: "provider-certification",
      label: "Provider certification",
      category: "quality",
      command: ["pnpm", "provider-certification:check"],
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Provider certification markdown",
          path: "ci-reports/package-quality/provider-certification.md",
          required: true,
        },
        {
          label: "Provider certification JSON",
          path: "ci-reports/package-quality/provider-certification.json",
          required: true,
        },
      ],
    },
    {
      id: "production-ready",
      label: "Production-ready package evidence",
      category: "quality",
      command: ["pnpm", "production-ready:check", "--", "--require-task-summaries"],
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Production-ready package markdown",
          path: "ci-reports/package-quality/production-ready.md",
          required: true,
        },
      ],
    },
    {
      id: "spine-promotion",
      label: "Beta spine promotion accountability",
      category: "quality",
      command: ["pnpm", "spine-promotion:check"],
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Beta spine promotion markdown",
          path: "ci-reports/package-quality/spine-promotion.md",
          required: true,
        },
      ],
    },
    {
      id: "spine-bundle-size",
      label: "Spine bundle-size enforcement",
      category: "quality",
      command: ["pnpm", "package-quality:report", "--", "--enforce-spine-bundle-size"],
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Package quality dashboard markdown",
          path: "ci-reports/package-quality/report.md",
          required: true,
        },
        {
          label: "Package quality dashboard JSON",
          path: "ci-reports/package-quality/summary.json",
          required: true,
        },
        {
          label: "Bundle-size enforcement markdown",
          path: "ci-reports/package-quality/bundle-size.md",
          required: true,
        },
      ],
    },
    {
      id: "core-coverage",
      label: "Core coverage gate",
      category: "coverage",
      command: ["pnpm", "test:coverage:core"],
      timeoutMs: minutes(45),
    },
    {
      id: "core-coverage-warning",
      label: "Core coverage warning report",
      category: "coverage",
      command: ["pnpm", "test:coverage:core:warning"],
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Core coverage warning markdown",
          path: "ci-reports/coverage/core-warning/report.md",
          required: true,
        },
      ],
    },
    {
      id: "public-api",
      label: "Public API snapshot",
      category: "public-api",
      command: ["pnpm", "public-api:check"],
      timeoutMs: minutes(10),
      artifacts: [
        {
          label: "Public API diff markdown",
          path: "ci-reports/package-quality/public-api-diff.md",
          required: true,
        },
        {
          label: "Public API summary JSON",
          path: "ci-reports/package-quality/public-api-summary.json",
          required: true,
        },
      ],
    },
  ];
}

function emptyArtifactReferences(command: EvidenceCommand): readonly EvidenceArtifactReference[] {
  return (command.artifacts ?? []).map((artifact) => ({
    ...artifact,
    copiedPath: null,
    copyError: null,
    exists: false,
    fresh: false,
    modifiedAt: null,
    sourcePath: artifact.path,
  }));
}

function createPendingCheck(command: EvidenceCommand): EvidenceCheckResult {
  return {
    ...command,
    artifacts: emptyArtifactReferences(command),
    completedAt: null,
    durationMs: null,
    effectiveTimeoutMs: null,
    errorCode: null,
    errorMessage: null,
    exitCode: null,
    failureReason: null,
    signal: null,
    startedAt: null,
    status: "pending",
    stderrExcerpt: "",
    stdoutExcerpt: "",
  };
}

function createInitialReport(options: {
  readonly commands: readonly EvidenceCommand[];
  readonly generatedAt: string;
  readonly outputDir: string;
  readonly rootDir: string;
  readonly totalTimeoutMs: number;
}): ReleaseSpineEvidenceReport {
  return summarizeReport({
    schemaVersion: 1,
    completedAt: null,
    generatedAt: options.generatedAt,
    outputDir: options.outputDir,
    rootDir: options.rootDir,
    status: "running",
    summary: emptySummary(options.commands.length),
    totalTimeoutMs: options.totalTimeoutMs,
    checks: options.commands.map(createPendingCheck),
  });
}

function emptySummary(total: number): ReleaseSpineEvidenceReport["summary"] {
  return {
    failed: 0,
    interrupted: 0,
    passed: 0,
    pending: total,
    running: 0,
    skippedAfterTimeout: 0,
    timedOut: 0,
    total,
  };
}

function summarizeReport(report: ReleaseSpineEvidenceReport): ReleaseSpineEvidenceReport {
  const summary = report.checks.reduce<ReleaseSpineEvidenceReport["summary"]>(
    (counts, check) => {
      if (check.status === "passed") {
        return { ...counts, passed: counts.passed + 1 };
      }
      if (check.status === "failed") {
        return { ...counts, failed: counts.failed + 1 };
      }
      if (check.status === "timed_out") {
        return { ...counts, timedOut: counts.timedOut + 1 };
      }
      if (check.status === "interrupted") {
        return { ...counts, interrupted: counts.interrupted + 1 };
      }
      if (check.status === "skipped_after_timeout") {
        return { ...counts, skippedAfterTimeout: counts.skippedAfterTimeout + 1 };
      }
      if (check.status === "running") {
        return { ...counts, running: counts.running + 1 };
      }
      return { ...counts, pending: counts.pending + 1 };
    },
    {
      failed: 0,
      interrupted: 0,
      passed: 0,
      pending: 0,
      running: 0,
      skippedAfterTimeout: 0,
      timedOut: 0,
      total: report.checks.length,
    },
  );

  return {
    ...report,
    summary,
    status: finalStatus(report.checks),
  };
}

function finalStatus(checks: readonly EvidenceCheckResult[]): ReleaseSpineEvidenceReport["status"] {
  if (checks.some((check) => check.status === "interrupted")) {
    return "interrupted";
  }
  if (
    checks.some((check) => check.status === "timed_out" || check.status === "skipped_after_timeout")
  ) {
    return "timed_out";
  }
  if (checks.some((check) => check.status === "failed")) {
    return "failed";
  }
  if (checks.some((check) => check.status === "running" || check.status === "pending")) {
    return "running";
  }
  return "passed";
}

function updateCheck(
  report: ReleaseSpineEvidenceReport,
  index: number,
  nextCheck: EvidenceCheckResult,
): ReleaseSpineEvidenceReport {
  return summarizeReport({
    ...report,
    checks: report.checks.map((check, checkIndex) => (checkIndex === index ? nextCheck : check)),
  });
}

function finishReport(
  report: ReleaseSpineEvidenceReport,
  completedAt: string,
): ReleaseSpineEvidenceReport {
  return summarizeReport({
    ...report,
    completedAt,
  });
}

function commandDisplay(command: readonly string[]): string {
  return command.join(" ");
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("utf-8");
  }
  return "";
}

function getErrorCode(error: Error | undefined): string | null {
  if (!error || !("code" in error)) {
    return null;
  }

  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function appendBoundedText(current: string, chunk: string): string {
  const next = `${current}${chunk}`;
  if (next.length <= commandOutputMaxBuffer) {
    return next;
  }

  return next.slice(-commandOutputMaxBuffer);
}

function killActiveCommand(signal: NodeJS.Signals): void {
  if (activeCommandProcess) {
    signalCommandProcessTree(activeCommandProcess, signal);
  }
}

function signalCommandProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid && process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (getErrorCode(error instanceof Error ? error : undefined) === "ESRCH") {
        return;
      }
    }
  }

  child.kill(signal);
}

export const defaultCommandRunner: CommandRunner = (check, context) =>
  new Promise<CommandRunResult>((resolveResult) => {
    const [command, ...args] = check.command;
    if (!command) {
      resolveResult({
        errorCode: "EMPTY_COMMAND",
        errorMessage: "Evidence command must not be empty.",
        signal: null,
        status: null,
        stderr: "",
        stdout: "",
        timedOut: false,
      });
      return;
    }

    let errorCode: string | null = null;
    let errorMessage: string | null = null;
    let killTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    let stderr = "";
    let stdout = "";
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: context.cwd,
      detached: process.platform !== "win32",
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeCommandProcess = child;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      signalCommandProcessTree(child, "SIGTERM");
      killTimer = setTimeout(() => {
        signalCommandProcessTree(child, "SIGKILL");
      }, commandTimeoutKillGraceMs);
    }, context.timeoutMs);

    const resolveOnce = (result: CommandRunResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutTimer);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      if (activeCommandProcess === child) {
        activeCommandProcess = null;
      }
      resolveResult(result);
    };

    child.stdout?.on("data", (chunk: unknown) => {
      stdout = appendBoundedText(stdout, toText(chunk));
    });
    child.stderr?.on("data", (chunk: unknown) => {
      stderr = appendBoundedText(stderr, toText(chunk));
    });
    child.once("error", (error) => {
      errorCode = getErrorCode(error);
      errorMessage = error.message;
      resolveOnce({
        errorCode,
        errorMessage,
        signal: null,
        status: null,
        stderr,
        stdout,
        timedOut,
      });
    });
    child.once("close", (status, signal) => {
      resolveOnce({
        errorCode,
        errorMessage,
        signal,
        status,
        stderr,
        stdout,
        timedOut,
      });
    });
  });

function outputExcerpt(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const omitted = value.length - maxLength;
  return `[truncated ${omitted} chars]\n${value.slice(-maxLength)}`;
}

function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

function relativeToRoot(rootDir: string, path: string): string {
  return toPosixPath(relative(rootDir, path));
}

function artifactCopyPath(outputDir: string, checkId: string, sourcePath: string): string {
  return join(outputDir, releaseArtifactDirectory, checkId, basename(sourcePath));
}

function collectArtifactReferences(
  check: EvidenceCommand,
  rootDir: string,
  outputDir: string,
  startedMs: number,
): readonly EvidenceArtifactReference[] {
  return (check.artifacts ?? []).map((artifact) => {
    const sourcePath = resolve(rootDir, artifact.path);
    const exists = existsSync(sourcePath);
    const modifiedAtMs = exists ? statSync(sourcePath).mtimeMs : null;
    const fresh = modifiedAtMs !== null && modifiedAtMs >= startedMs;
    const copiedPath = exists && fresh ? artifactCopyPath(outputDir, check.id, sourcePath) : null;
    let copyError: string | null = null;

    if (copiedPath) {
      try {
        mkdirSync(dirname(copiedPath), { recursive: true });
        copyFileSync(sourcePath, copiedPath);
      } catch (error) {
        copyError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      ...artifact,
      copiedPath: copiedPath ? relativeToRoot(rootDir, copiedPath) : null,
      copyError,
      exists,
      fresh,
      modifiedAt: modifiedAtMs !== null ? new Date(modifiedAtMs).toISOString() : null,
      sourcePath: artifact.path,
    };
  });
}

function artifactFailureReason(artifacts: readonly EvidenceArtifactReference[]): string | null {
  const missing = artifacts.filter((artifact) => artifact.required && !artifact.exists);
  if (missing.length > 0) {
    return `Required release evidence artifact(s) were not produced: ${missing
      .map((artifact) => artifact.sourcePath)
      .join(", ")}`;
  }

  const stale = artifacts.filter((artifact) => artifact.required && !artifact.fresh);
  if (stale.length > 0) {
    return `Required release evidence artifact(s) were not refreshed by their command: ${stale
      .map((artifact) => artifact.sourcePath)
      .join(", ")}`;
  }

  const failedCopies = artifacts.filter((artifact) => artifact.required && artifact.copyError);
  if (failedCopies.length > 0) {
    return `Required release evidence artifact(s) could not be copied: ${failedCopies
      .map((artifact) => `${artifact.sourcePath}: ${artifact.copyError}`)
      .join("; ")}`;
  }

  return null;
}

function resultStatus(result: CommandRunResult): EvidenceStatus {
  if (result.timedOut) {
    return "timed_out";
  }

  return result.status === 0 ? "passed" : "failed";
}

function failureReason(result: CommandRunResult, artifactReason: string | null): string | null {
  if (result.timedOut) {
    return "Command timed out before it could produce passing evidence.";
  }
  if (result.errorMessage) {
    return result.errorMessage;
  }
  if (result.status !== 0) {
    return `Command exited with status ${result.status ?? "unknown"}.`;
  }
  if (artifactReason) {
    return artifactReason;
  }

  return null;
}

function markSkippedAfterTimeout(
  report: ReleaseSpineEvidenceReport,
  startIndex: number,
  completedAt: string,
): ReleaseSpineEvidenceReport {
  return summarizeReport({
    ...report,
    checks: report.checks.map((check, index) => {
      if (index < startIndex || check.status !== "pending") {
        return check;
      }

      return {
        ...check,
        completedAt,
        failureReason: "Total release spine evidence timeout was exhausted before this check ran.",
        status: "skipped_after_timeout",
      };
    }),
  });
}

export function markReportInterrupted(
  report: ReleaseSpineEvidenceReport,
  signal: string,
  completedAt: string,
): ReleaseSpineEvidenceReport {
  return finishReport(
    {
      ...report,
      checks: report.checks.map((check) => {
        if (check.status !== "running" && check.status !== "pending") {
          return check;
        }

        return {
          ...check,
          completedAt,
          failureReason: `Release spine evidence was interrupted by ${signal}.`,
          signal,
          status: "interrupted",
        };
      }),
    },
    completedAt,
  );
}

export async function runReleaseSpineEvidence(
  options: RunOptions,
): Promise<ReleaseSpineEvidenceReport> {
  const clock = options.clock ?? systemClock;
  const commands = options.commands ?? createReleaseSpineEvidenceManifest();
  const runner = options.runner ?? defaultCommandRunner;
  const maxOutputExcerptLength = options.maxOutputExcerptLength ?? defaultOutputExcerptLength;
  const rootDir = resolve(options.rootDir);
  const outputDir = resolve(rootDir, options.outputDir);
  const runStartedAtMs = clock.nowMs();
  let report = createInitialReport({
    commands,
    generatedAt: clock.nowIso(),
    outputDir,
    rootDir,
    totalTimeoutMs: options.totalTimeoutMs,
  });

  const checkpoint = () => {
    const writtenReport = writeReleaseSpineEvidenceReport(report, outputDir);
    options.onCheckpoint?.(writtenReport);
  };

  checkpoint();

  for (const [index, check] of commands.entries()) {
    const elapsedMs = clock.nowMs() - runStartedAtMs;
    const remainingTotalTimeoutMs = options.totalTimeoutMs - elapsedMs;
    if (remainingTotalTimeoutMs <= 0) {
      report = markSkippedAfterTimeout(report, index, clock.nowIso());
      checkpoint();
      break;
    }

    const startedAt = clock.nowIso();
    const startedMs = clock.nowMs();
    const effectiveTimeoutMs = Math.min(check.timeoutMs, remainingTotalTimeoutMs);
    report = updateCheck(report, index, {
      ...report.checks[index],
      effectiveTimeoutMs,
      startedAt,
      status: "running",
    });
    checkpoint();

    const result = await runner(check, {
      cwd: rootDir,
      timeoutMs: effectiveTimeoutMs,
    });
    const completedAt = clock.nowIso();
    const durationMs = Math.max(0, clock.nowMs() - startedMs);
    const artifacts = collectArtifactReferences(check, rootDir, outputDir, startedMs);
    const artifactReason = artifactFailureReason(artifacts);
    const status =
      artifactReason && result.status === 0 && !result.timedOut ? "failed" : resultStatus(result);

    report = updateCheck(report, index, {
      ...report.checks[index],
      artifacts,
      completedAt,
      durationMs,
      effectiveTimeoutMs,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      exitCode: result.status,
      failureReason: failureReason(result, artifactReason),
      signal: result.signal,
      status,
      stderrExcerpt: outputExcerpt(result.stderr, maxOutputExcerptLength),
      stdoutExcerpt: outputExcerpt(result.stdout, maxOutputExcerptLength),
    });
    checkpoint();
  }

  report = finishReport(report, clock.nowIso());
  checkpoint();
  return report;
}

function formatDuration(ms: number | null): string {
  if (ms === null) {
    return "not collected";
  }

  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTimeout(ms: number | null): string {
  if (ms === null) {
    return "not started";
  }

  return `${(ms / 1000).toFixed(0)}s`;
}

function formatExit(check: EvidenceCheckResult): string {
  if (check.exitCode !== null) {
    return String(check.exitCode);
  }
  if (check.signal) {
    return check.signal;
  }
  if (check.errorCode) {
    return check.errorCode;
  }
  return "-";
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function formatArtifacts(check: EvidenceCheckResult): string {
  if (check.artifacts.length === 0) {
    return "-";
  }

  return check.artifacts
    .map((artifact) => {
      const status = !artifact.exists ? "missing" : artifact.fresh ? "present" : "stale";
      const copied = artifact.copiedPath ? `, copied: \`${artifact.copiedPath}\`` : "";
      const copyError = artifact.copyError ? `, copy error: ${artifact.copyError}` : "";
      const modified = artifact.modifiedAt ? `, modified: ${artifact.modifiedAt}` : "";
      return `${artifact.label} (${status}${modified}${copied}${copyError})`;
    })
    .join("<br>");
}

function formatOutputSection(label: string, value: string): readonly string[] {
  if (!value.trim()) {
    return [];
  }

  return ["", `${label}:`, "", "```text", value, "```"];
}

export function buildReleaseSpineEvidenceMarkdown(report: ReleaseSpineEvidenceReport): string {
  const lines = [
    "# Release Spine Evidence",
    "",
    `- Status: ${report.status}`,
    `- Generated at: ${report.generatedAt}`,
    `- Completed at: ${report.completedAt ?? "not complete"}`,
    `- Root: \`${toPosixPath(report.rootDir)}\``,
    `- Output directory: \`${toPosixPath(report.outputDir)}\``,
    `- Total timeout: ${formatTimeout(report.totalTimeoutMs)}`,
    `- Checks: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.failed} failed, ${report.summary.timedOut} timed out, ${report.summary.interrupted} interrupted, ${report.summary.skippedAfterTimeout} skipped after timeout`,
    "",
    "## Check summary",
    "",
    "| Check | Category | Command | Status | Exit | Duration | Timeout | Evidence artifacts |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- |",
    ...report.checks.map(
      (check) =>
        `| ${escapeTableCell(check.label)} | ${check.category} | \`${escapeTableCell(commandDisplay(check.command))}\` | ${check.status} | ${escapeTableCell(formatExit(check))} | ${formatDuration(check.durationMs)} | ${formatTimeout(check.effectiveTimeoutMs)} | ${formatArtifacts(check)} |`,
    ),
    "",
    "## Check details",
  ];

  for (const check of report.checks) {
    lines.push(
      "",
      `### ${check.label}`,
      "",
      `- ID: \`${check.id}\``,
      `- Status: ${check.status}`,
      `- Command: \`${commandDisplay(check.command)}\``,
      `- Started at: ${check.startedAt ?? "not started"}`,
      `- Completed at: ${check.completedAt ?? "not complete"}`,
      `- Duration: ${formatDuration(check.durationMs)}`,
      `- Timeout: ${formatTimeout(check.effectiveTimeoutMs)}`,
      `- Failure reason: ${check.failureReason ?? "none"}`,
      "",
      "Artifacts:",
      ...(check.artifacts.length === 0
        ? ["- none"]
        : check.artifacts.map((artifact) => {
            const required = artifact.required ? "required" : "optional";
            const status = !artifact.exists ? "missing" : artifact.fresh ? "present" : "stale";
            const modified = artifact.modifiedAt ? `; modified at ${artifact.modifiedAt}` : "";
            const copied = artifact.copiedPath ? `; copied to \`${artifact.copiedPath}\`` : "";
            const copyError = artifact.copyError ? `; copy error: ${artifact.copyError}` : "";
            return `- ${artifact.label} (${required}): \`${artifact.sourcePath}\` ${status}${modified}${copied}${copyError}`;
          })),
      ...formatOutputSection("stdout excerpt", check.stdoutExcerpt),
      ...formatOutputSection("stderr excerpt", check.stderrExcerpt),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function writeReleaseSpineEvidenceReport(
  report: ReleaseSpineEvidenceReport,
  outputDir: string,
): ReleaseSpineEvidenceReport {
  mkdirSync(outputDir, { recursive: true });
  const summarized = summarizeReport(report);
  writeFileSync(join(outputDir, reportJsonFileName), `${JSON.stringify(summarized, null, 2)}\n`);
  writeFileSync(
    join(outputDir, reportMarkdownFileName),
    buildReleaseSpineEvidenceMarkdown(summarized),
  );
  return summarized;
}

function parsePositiveInteger(value: string, flag: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${flag} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
}

export function parseArgs(args: readonly string[] = argv.slice(2)): Options {
  let rootDir = process.cwd();
  let outputDir = join(rootDir, defaultOutputDirectory);
  let outputDirWasExplicit = false;
  let totalTimeoutMs = defaultTotalTimeoutMs;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      if (!outputDirWasExplicit) {
        outputDir = join(rootDir, defaultOutputDirectory);
      }
      index++;
      continue;
    }

    if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--output-dir requires a path");
      }
      outputDir = resolve(value);
      outputDirWasExplicit = true;
      index++;
      continue;
    }

    if (arg === "--total-timeout-ms") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--total-timeout-ms requires a value");
      }
      totalTimeoutMs = parsePositiveInteger(value, "--total-timeout-ms");
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    rootDir: resolve(rootDir),
    outputDir: resolve(outputDir),
    totalTimeoutMs,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));
  const commands = createReleaseSpineEvidenceManifest();
  let latestReport: ReleaseSpineEvidenceReport | null = createInitialReport({
    commands,
    generatedAt: systemClock.nowIso(),
    outputDir: options.outputDir,
    rootDir: options.rootDir,
    totalTimeoutMs: options.totalTimeoutMs,
  });

  const checkpoint = (report: ReleaseSpineEvidenceReport) => {
    latestReport = report;
  };
  const interrupt = (signal: string) => {
    killActiveCommand(signal as NodeJS.Signals);
    if (latestReport) {
      const interrupted = markReportInterrupted(latestReport, signal, systemClock.nowIso());
      writeReleaseSpineEvidenceReport(interrupted, options.outputDir);
    }
    console.error(`release-spine-evidence: interrupted by ${signal}`);
    exit(signal === "SIGINT" ? 130 : 143);
  };

  process.once("SIGINT", () => interrupt("SIGINT"));
  process.once("SIGTERM", () => interrupt("SIGTERM"));

  const report = await runReleaseSpineEvidence({
    ...options,
    commands,
    onCheckpoint: checkpoint,
  });

  console.log(`release-spine-evidence: wrote ${join(options.outputDir, reportMarkdownFileName)}`);
  console.log(`release-spine-evidence: wrote ${join(options.outputDir, reportJsonFileName)}`);
  console.log(
    `release-spine-evidence: status=${report.status} passed=${report.summary.passed}/${report.summary.total}`,
  );

  exit(report.status === "passed" ? 0 : 1);
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`release-spine-evidence: failed: ${message}`);
    exit(1);
  });
}

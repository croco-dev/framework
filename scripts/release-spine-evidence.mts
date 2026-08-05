#!/usr/bin/env node

import { execFileSync, spawn } from "node:child_process";
import {
  closeSync,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import {
  assertGeneratedSmokeJourneyLinks,
  assertGeneratedSmokeJourneyReport,
  renderGeneratedSmokeJourneyReport,
} from "./create-croco-app-generated-smoke-journey-report.mts";
import { assertTestEvidenceBundle } from "./test-evidence-runtime.mts";
import { createVerificationManifest } from "./verification-manifest.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";
import type { ChildProcess } from "node:child_process";
import type { VerificationProfile } from "./verification-manifest.mts";

const DEFAULT_OUTPUT_DIRECTORY = join("ci-reports", "release");
const REPORT_MARKDOWN_FILE_NAME = "spine-evidence.md";
const REPORT_JSON_FILE_NAME = "spine-evidence.json";
const RELEASE_ARTIFACT_DIRECTORY = "artifacts";
const DEFAULT_TOTAL_TIMEOUT_MS = 150 * 60 * 1000;
const DEFAULT_OUTPUT_EXCERPT_LENGTH = 4_000;
const COMMAND_OUTPUT_MAX_BUFFER = 50 * 1024 * 1024;
const COMMAND_TIMEOUT_KILL_GRACE_MS = 5_000;

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
  | "skipped_after_timeout"
  | "not_applicable";

export type EvidenceArtifactExpectation = {
  readonly label: string;
  readonly path: string;
  readonly required: boolean;
  readonly copyRelativePath?: string;
};

export type EvidenceArtifactReference = EvidenceArtifactExpectation & {
  readonly copiedPath: string | null;
  readonly copyError: string | null;
  readonly exists: boolean;
  readonly fresh: boolean;
  readonly modifiedAt: string | null;
  readonly reusedEvidenceRecordId?: string;
  readonly sourcePath: string;
};

export type EvidenceCommand = {
  readonly id: string;
  readonly label: string;
  readonly category: EvidenceCategory;
  readonly command: readonly string[];
  readonly timeoutMs: number;
  readonly applicable?: boolean;
  readonly selectionReason?: string;
  readonly artifacts?: readonly EvidenceArtifactExpectation[];
  readonly reusedEvidence?: {
    readonly path: string;
    readonly recordId: string;
  };
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
  readonly profile: VerificationProfile;
  readonly provenance: {
    readonly commitSha: string;
    readonly runAttempt: string;
    readonly runId: string;
  };
  readonly rootDir: string;
  readonly status: "running" | "passed" | "failed" | "timed_out" | "interrupted";
  readonly summary: {
    readonly failed: number;
    readonly interrupted: number;
    readonly notApplicable: number;
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
  readonly stderrFileComplete?: boolean;
  readonly stdout: string;
  readonly stdoutFileComplete?: boolean;
  readonly timedOut: boolean;
};

export type CommandRunner = (
  command: EvidenceCommand,
  context: {
    readonly cwd: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly maxOutputBufferLength?: number;
    readonly stderrPath?: string;
    readonly stdoutPath?: string;
    readonly timeoutMs: number;
    readonly writeOutput?: (
      descriptor: number,
      output: Uint8Array,
      offset: number,
      length: number,
    ) => number;
  },
) => CommandRunResult | Promise<CommandRunResult>;

export type Clock = {
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

type Options = {
  readonly allowPendingReleaseMetadata?: boolean;
  readonly rootDir: string;
  readonly outputDir: string;
  readonly totalTimeoutMs: number;
  readonly profile?: VerificationProfile;
  readonly base?: string;
  readonly head?: string;
  readonly testEvidencePath?: string;
};

type RunOptions = Options & {
  readonly changedFiles?: readonly string[];
  readonly clock?: Clock;
  readonly commands?: readonly EvidenceCommand[];
  readonly getInterruptSignal?: () => NodeJS.Signals | null;
  readonly commandOutputWriter?: CommandRunnerContext["writeOutput"];
  readonly maxCommandOutputBufferLength?: number;
  readonly maxOutputExcerptLength?: number;
  readonly onCheckpoint?: (report: ReleaseSpineEvidenceReport) => void;
  readonly runner?: CommandRunner;
};

type CommandRunnerContext = Parameters<CommandRunner>[1];

const systemClock: Clock = {
  nowIso: () => new Date().toISOString(),
  nowMs: () => Date.now(),
};

function readCurrentCommit(rootDir: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function readCurrentCommitOrUnknown(rootDir: string): string {
  try {
    return readCurrentCommit(rootDir);
  } catch {
    return "unknown";
  }
}

function readChangedFiles(
  rootDir: string,
  base?: string,
  head?: string,
): readonly string[] | undefined {
  if (!base || !head) return undefined;
  try {
    return execFileSync("git", ["diff", "--name-only", base, head], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {
    return undefined;
  }
}
let activeCommandProcess: ChildProcess | null = null;
let activeInterruptKillTimer: ReturnType<typeof setTimeout> | null = null;

export function createReleaseSpineEvidenceManifest(): readonly EvidenceCommand[] {
  return createVerificationManifest("spine");
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
  readonly profile: VerificationProfile;
  readonly provenance: ReleaseSpineEvidenceReport["provenance"];
  readonly rootDir: string;
  readonly totalTimeoutMs: number;
}): ReleaseSpineEvidenceReport {
  return summarizeReport({
    schemaVersion: 1,
    completedAt: null,
    generatedAt: options.generatedAt,
    outputDir: options.outputDir,
    profile: options.profile,
    provenance: options.provenance,
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
    notApplicable: 0,
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
      if (check.status === "not_applicable") {
        return { ...counts, notApplicable: counts.notApplicable + 1 };
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
      notApplicable: 0,
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

function clearReusedEvidence(check: EvidenceCheckResult): EvidenceCheckResult {
  const next = { ...check };
  delete next.reusedEvidence;
  return next;
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

function appendBoundedText(
  current: string,
  chunk: string,
  maxLength = COMMAND_OUTPUT_MAX_BUFFER,
): string {
  const next = `${current}${chunk}`;
  if (next.length <= maxLength) {
    return next;
  }

  return next.slice(-maxLength);
}

export function interruptActiveCommand(
  signal: NodeJS.Signals,
  killGraceMs = COMMAND_TIMEOUT_KILL_GRACE_MS,
): void {
  const child = activeCommandProcess;
  if (!child) {
    return;
  }

  signalCommandProcessTree(child, signal);
  if (signal === "SIGKILL") {
    return;
  }
  if (activeInterruptKillTimer) {
    clearTimeout(activeInterruptKillTimer);
  }
  activeInterruptKillTimer = setTimeout(() => {
    if (activeCommandProcess === child) {
      signalCommandProcessTree(child, "SIGKILL");
    }
    activeInterruptKillTimer = null;
  }, killGraceMs);
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
        stderrFileComplete: false,
        stdout: "",
        stdoutFileComplete: false,
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
    const writeOutput =
      context.writeOutput ??
      ((descriptor: number, output: Uint8Array, offset: number, length: number) =>
        writeSync(descriptor, output, offset, length));
    let stdoutFileComplete = context.stdoutPath === undefined;
    let stderrFileComplete = context.stderrPath === undefined;
    let stdoutDescriptor: number | null = null;
    let stderrDescriptor: number | null = null;
    const recordOutputError = (stream: "stderr" | "stdout", error: unknown) => {
      if (stream === "stdout") {
        stdoutFileComplete = false;
      } else {
        stderrFileComplete = false;
      }
      if (errorMessage !== null) {
        return;
      }
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      errorCode = getErrorCode(normalizedError);
      errorMessage = `Failed to persist command ${stream}: ${normalizedError.message}`;
    };
    const closeOutput = (stream: "stderr" | "stdout", descriptor: number | null) => {
      if (descriptor === null) {
        return;
      }
      try {
        closeSync(descriptor);
      } catch (error) {
        recordOutputError(stream, error);
      }
    };
    try {
      stdoutDescriptor = openCommandOutput(context.stdoutPath);
      stdoutFileComplete = true;
    } catch (error) {
      recordOutputError("stdout", error);
    }
    if (errorMessage === null) {
      try {
        stderrDescriptor = openCommandOutput(context.stderrPath);
        stderrFileComplete = true;
      } catch (error) {
        recordOutputError("stderr", error);
      }
    }
    if (errorMessage !== null) {
      closeOutput("stdout", stdoutDescriptor);
      closeOutput("stderr", stderrDescriptor);
      resolveResult({
        errorCode,
        errorMessage,
        signal: null,
        status: null,
        stderr,
        stderrFileComplete,
        stdout,
        stdoutFileComplete,
        timedOut: false,
      });
      return;
    }
    const child = spawn(command, args, {
      cwd: context.cwd,
      detached: process.platform !== "win32",
      env: context.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeCommandProcess = child;

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      signalCommandProcessTree(child, "SIGTERM");
      killTimer = setTimeout(() => {
        signalCommandProcessTree(child, "SIGKILL");
      }, COMMAND_TIMEOUT_KILL_GRACE_MS);
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
      if (activeInterruptKillTimer) {
        clearTimeout(activeInterruptKillTimer);
        activeInterruptKillTimer = null;
      }
      closeOutput("stdout", stdoutDescriptor);
      closeOutput("stderr", stderrDescriptor);
      resolveResult({
        ...result,
        errorCode: errorCode ?? result.errorCode,
        errorMessage: errorMessage ?? result.errorMessage,
        stderrFileComplete,
        status: errorMessage ? null : result.status,
        stdoutFileComplete,
      });
    };

    child.stdout?.on("data", (chunk: unknown) => {
      const output = toText(chunk);
      if (stdoutDescriptor !== null) {
        try {
          writeAllCommandOutput(stdoutDescriptor, output, writeOutput);
        } catch (error) {
          recordOutputError("stdout", error);
          closeOutput("stdout", stdoutDescriptor);
          stdoutDescriptor = null;
          signalCommandProcessTree(child, "SIGTERM");
          if (!killTimer) {
            killTimer = setTimeout(
              () => signalCommandProcessTree(child, "SIGKILL"),
              COMMAND_TIMEOUT_KILL_GRACE_MS,
            );
          }
        }
      }
      stdout = appendBoundedText(stdout, output, context.maxOutputBufferLength);
    });
    child.stderr?.on("data", (chunk: unknown) => {
      const output = toText(chunk);
      if (stderrDescriptor !== null) {
        try {
          writeAllCommandOutput(stderrDescriptor, output, writeOutput);
        } catch (error) {
          recordOutputError("stderr", error);
          closeOutput("stderr", stderrDescriptor);
          stderrDescriptor = null;
          signalCommandProcessTree(child, "SIGTERM");
          if (!killTimer) {
            killTimer = setTimeout(
              () => signalCommandProcessTree(child, "SIGKILL"),
              COMMAND_TIMEOUT_KILL_GRACE_MS,
            );
          }
        }
      }
      stderr = appendBoundedText(stderr, output, context.maxOutputBufferLength);
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

function openCommandOutput(path: string | undefined): number | null {
  if (!path) {
    return null;
  }

  mkdirSync(dirname(path), { recursive: true });
  return openSync(path, "w");
}

function writeAllCommandOutput(
  descriptor: number,
  output: string,
  writer: NonNullable<CommandRunnerContext["writeOutput"]>,
): void {
  const buffer = Buffer.from(output, "utf8");
  let offset = 0;
  while (offset < buffer.byteLength) {
    const remaining = buffer.byteLength - offset;
    const written = writer(descriptor, buffer, offset, remaining);
    if (!Number.isInteger(written) || written <= 0 || written > remaining) {
      throw new Error(`Command output writer returned invalid byte count ${written}.`);
    }
    offset += written;
  }
}

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

function artifactCopyPath(
  outputDir: string,
  checkId: string,
  artifact: EvidenceArtifactExpectation,
): string {
  const copyRelativePath = (artifact.copyRelativePath ?? basename(artifact.path)).replaceAll(
    "\\",
    "/",
  );
  const copyRoot = join(outputDir, RELEASE_ARTIFACT_DIRECTORY, checkId);
  const destination = resolve(copyRoot, copyRelativePath);
  const destinationRelativePath = relative(copyRoot, destination).replaceAll("\\", "/");
  if (
    isAbsolute(copyRelativePath) ||
    /^[A-Za-z]:\//.test(copyRelativePath) ||
    destinationRelativePath === ".." ||
    destinationRelativePath.startsWith("../")
  ) {
    throw new VerificationProblem(
      "UNSAFE_EVIDENCE_COPY_PATH",
      "input",
      `Unsafe release evidence copy path: ${copyRelativePath}`,
    );
  }
  return destination;
}

function collectArtifactReferences(
  check: EvidenceCommand,
  rootDir: string,
  outputDir: string,
  startedMs: number,
): readonly EvidenceArtifactReference[] {
  let references = (check.artifacts ?? []).map((artifact) => {
    const sourcePath = resolve(rootDir, artifact.path);
    const exists = existsSync(sourcePath);
    const modifiedAtMs = exists ? statSync(sourcePath).mtimeMs : null;
    const fresh = modifiedAtMs !== null && modifiedAtMs >= startedMs;
    let copiedPath: string | null = null;
    let copyError: string | null = null;

    if (exists && fresh) {
      try {
        copiedPath = artifactCopyPath(outputDir, check.id, artifact);
        mkdirSync(dirname(copiedPath), { recursive: true });
        cpSync(sourcePath, copiedPath, { recursive: true });
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

  if (check.id === "generated-app-spine-smoke" || check.id === "generated-app-smoke") {
    try {
      assertCopiedGeneratedSmokeJourneyBundle(
        join(outputDir, RELEASE_ARTIFACT_DIRECTORY, check.id, "spine-blocking-journeys"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const validationTarget =
        references.find(
          ({ copyRelativePath }) => copyRelativePath === "spine-blocking-journeys/report.json",
        ) ?? references[0];
      references = references.map((reference) =>
        reference === validationTarget ? { ...reference, copyError: message } : reference,
      );
    }
  }

  return references;
}

function collectReusedArtifactReferences(
  check: EvidenceCommand,
  rootDir: string,
  recordId: string,
): readonly EvidenceArtifactReference[] {
  return (check.artifacts ?? []).map((artifact) => {
    const sourcePath = resolve(rootDir, artifact.path);
    const exists = existsSync(sourcePath);
    const modifiedAtMs = exists ? statSync(sourcePath).mtimeMs : null;
    return {
      ...artifact,
      copiedPath: null,
      copyError: null,
      exists,
      fresh: false,
      modifiedAt: modifiedAtMs === null ? null : new Date(modifiedAtMs).toISOString(),
      reusedEvidenceRecordId: recordId,
      sourcePath: artifact.path,
    };
  });
}

function persistFailedCommandOutput(
  checkId: string,
  result: CommandRunResult,
  rootDir: string,
  outputDir: string,
  modifiedAt: string,
): readonly EvidenceArtifactReference[] {
  const outputRoot = join(outputDir, RELEASE_ARTIFACT_DIRECTORY, checkId);
  const streams: readonly (readonly [
    label: string,
    fileName: string,
    output: string,
    fileComplete: boolean | undefined,
  ])[] = [
    ["Command stdout", "stdout.log", result.stdout, result.stdoutFileComplete],
    ["Command stderr", "stderr.log", result.stderr, result.stderrFileComplete],
  ];

  return streams.map(([label, fileName, output, fileComplete]) => {
    const outputPath = join(outputRoot, fileName);
    let writeError: string | null = null;
    const usedFallback = fileComplete !== true || !existsSync(outputPath);
    let wroteCurrentOutput = !usedFallback;
    if (!wroteCurrentOutput) {
      try {
        mkdirSync(outputRoot, { recursive: true });
        writeFileSync(outputPath, output);
        wroteCurrentOutput = true;
      } catch (error) {
        writeError = error instanceof Error ? error.message : String(error);
      }
    }
    const artifactPath = relativeToRoot(rootDir, outputPath);
    const exists = existsSync(outputPath);

    return {
      label: usedFallback ? `${label} (bounded fallback; may be truncated)` : label,
      path: artifactPath,
      required: false,
      copiedPath: exists && wroteCurrentOutput ? artifactPath : null,
      copyError: writeError,
      exists,
      fresh: exists && wroteCurrentOutput,
      modifiedAt,
      sourcePath: artifactPath,
    };
  });
}

function discardCommandOutput(outputDir: string, checkId: string): string | null {
  const outputRoot = join(outputDir, RELEASE_ARTIFACT_DIRECTORY, checkId);
  const cleanupErrors: string[] = [];
  for (const fileName of ["stdout.log", "stderr.log"]) {
    const outputPath = join(outputRoot, fileName);
    try {
      rmSync(outputPath, { force: true });
    } catch (error) {
      cleanupErrors.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return cleanupErrors.length > 0
    ? `Command output cleanup failed: ${cleanupErrors.join("; ")}`
    : null;
}

function assertCopiedGeneratedSmokeJourneyBundle(bundleRoot: string): void {
  const reportJson = JSON.parse(readFileSync(join(bundleRoot, "report.json"), "utf8"));
  assertGeneratedSmokeJourneyReport(reportJson);
  const reportMarkdown = readFileSync(join(bundleRoot, "report.md"), "utf8");
  if (reportMarkdown !== renderGeneratedSmokeJourneyReport(reportJson)) {
    throw new VerificationProblem(
      "GENERATED_SMOKE_EVIDENCE_MISMATCH",
      "contract",
      "Copied generated smoke journey Markdown does not match report.json",
    );
  }
  assertGeneratedSmokeJourneyLinks(bundleRoot, reportJson);
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

function rejectedCommandRunResult(error: unknown): CommandRunResult {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  return {
    errorCode: getErrorCode(normalizedError),
    errorMessage: normalizedError.message,
    signal: null,
    status: null,
    stderr: "",
    stderrFileComplete: false,
    stdout: "",
    stdoutFileComplete: false,
    timedOut: false,
  };
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
  const profile = options.profile ?? "spine";
  const rootDir = resolve(options.rootDir);
  const unresolvedCommands =
    options.commands ??
    createVerificationManifest(profile, {
      allowPendingReleaseMetadata: options.allowPendingReleaseMetadata,
      base: options.base,
      changedFiles: options.changedFiles ?? readChangedFiles(rootDir, options.base, options.head),
      head: options.head,
    });
  const commitSha = process.env.GITHUB_SHA ?? readCurrentCommitOrUnknown(rootDir);
  const commands = options.testEvidencePath
    ? reuseTestEvidence(
        unresolvedCommands,
        resolve(rootDir, options.testEvidencePath),
        commitSha,
        profile,
        rootDir,
      )
    : unresolvedCommands;
  const runner = options.runner ?? defaultCommandRunner;
  const maxOutputExcerptLength = options.maxOutputExcerptLength ?? DEFAULT_OUTPUT_EXCERPT_LENGTH;
  const outputDir = resolve(rootDir, options.outputDir);
  const generatedAt = clock.nowIso();
  const provenance = {
    commitSha,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "1",
    runId: process.env.GITHUB_RUN_ID ?? generatedAt,
  };
  const runStartedAtMs = clock.nowMs();
  let report = createInitialReport({
    commands,
    generatedAt,
    outputDir,
    profile,
    provenance,
    rootDir,
    totalTimeoutMs: options.totalTimeoutMs,
  });

  const checkpoint = () => {
    const writtenReport = writeReleaseSpineEvidenceReport(report, outputDir);
    options.onCheckpoint?.(writtenReport);
  };

  const dashboardStatus = (id: string): string => {
    const status = report.checks.find((candidate) => candidate.id === id)?.status;
    if (status === "passed") return "success";
    if (status === "failed" || status === "timed_out" || status === "interrupted") return "failure";
    return "skipped";
  };

  checkpoint();

  for (const [index, check] of commands.entries()) {
    const signalBeforeCheck = options.getInterruptSignal?.() ?? null;
    if (signalBeforeCheck) {
      report = markReportInterrupted(report, signalBeforeCheck, clock.nowIso());
      checkpoint();
      break;
    }
    if (check.applicable === false) {
      report = updateCheck(report, index, {
        ...report.checks[index],
        completedAt: clock.nowIso(),
        failureReason:
          check.selectionReason ??
          "Not applicable to the changed files in this verification context.",
        status: "not_applicable",
      });
      checkpoint();
      continue;
    }
    if (check.reusedEvidence) {
      const artifacts = collectReusedArtifactReferences(
        check,
        rootDir,
        check.reusedEvidence.recordId,
      );
      if (artifacts.every((artifact) => !artifact.required || artifact.exists)) {
        report = updateCheck(report, index, {
          ...report.checks[index],
          artifacts,
          completedAt: clock.nowIso(),
          durationMs: 0,
          effectiveTimeoutMs: 0,
          exitCode: 0,
          status: "passed",
          stdoutExcerpt: `Reused ${check.reusedEvidence.recordId} from ${check.reusedEvidence.path} for commit ${commitSha}.`,
        });
        checkpoint();
        continue;
      }
      report = updateCheck(report, index, {
        ...clearReusedEvidence(report.checks[index]),
      });
    }
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

    const baseCommandEnv =
      check.id === "core-coverage"
        ? { ...process.env, CORE_COVERAGE: "true", SKIP_ENV_VALIDATION: "true" }
        : process.env;
    const commandEnv =
      check.id === "spine-bundle-size"
        ? {
            ...baseCommandEnv,
            PACKAGE_QUALITY_CHANGESET_STATUS: dashboardStatus("changeset-required"),
            PACKAGE_QUALITY_CHECK_STATUS:
              dashboardStatus("lint") === "success" && dashboardStatus("format") === "success"
                ? "success"
                : dashboardStatus("lint") === "failure" || dashboardStatus("format") === "failure"
                  ? "failure"
                  : "skipped",
            PACKAGE_QUALITY_BUILD_STATUS: dashboardStatus("build"),
            PACKAGE_QUALITY_TYPECHECK_STATUS: dashboardStatus("typecheck"),
            PACKAGE_QUALITY_TEST_STATUS: dashboardStatus("test"),
            PACKAGE_QUALITY_PROVIDER_CERTIFICATION_STATUS:
              dashboardStatus("provider-certification"),
            PACKAGE_QUALITY_PRODUCTION_READY_STATUS: dashboardStatus("production-ready"),
            PACKAGE_QUALITY_SPINE_PROMOTION_STATUS: dashboardStatus("spine-promotion"),
          }
        : baseCommandEnv;
    let result: CommandRunResult;
    try {
      result = await runner(check, {
        cwd: rootDir,
        env:
          check.id === "spine-promotion"
            ? {
                ...process.env,
                SPINE_PROMOTION_COMMIT_SHA: report.provenance.commitSha,
                SPINE_PROMOTION_RELEASE_CHECKPOINT: join(outputDir, REPORT_JSON_FILE_NAME),
                SPINE_PROMOTION_RUN_ATTEMPT: report.provenance.runAttempt,
                SPINE_PROMOTION_RUN_ID: report.provenance.runId,
              }
            : commandEnv,
        maxOutputBufferLength: options.maxCommandOutputBufferLength,
        stderrPath: join(outputDir, RELEASE_ARTIFACT_DIRECTORY, check.id, "stderr.log"),
        stdoutPath: join(outputDir, RELEASE_ARTIFACT_DIRECTORY, check.id, "stdout.log"),
        timeoutMs: effectiveTimeoutMs,
        writeOutput: options.commandOutputWriter,
      });
    } catch (error) {
      result = rejectedCommandRunResult(error);
    }
    const completedAt = clock.nowIso();
    const durationMs = Math.max(0, clock.nowMs() - startedMs);
    const commandArtifacts = collectArtifactReferences(check, rootDir, outputDir, startedMs);
    const artifactReason = artifactFailureReason(commandArtifacts);
    const interruptionSignal = options.getInterruptSignal?.() ?? null;
    let status = interruptionSignal
      ? "interrupted"
      : artifactReason && result.status === 0 && !result.timedOut
        ? "failed"
        : resultStatus(result);
    let cleanupError: string | null = null;
    if (status !== "failed" && status !== "timed_out" && status !== "interrupted") {
      cleanupError = discardCommandOutput(outputDir, check.id);
      if (cleanupError) {
        status = "failed";
      }
    }
    const artifacts =
      status === "failed" || status === "timed_out" || status === "interrupted"
        ? [
            ...commandArtifacts,
            ...persistFailedCommandOutput(check.id, result, rootDir, outputDir, completedAt),
          ]
        : commandArtifacts;

    report = updateCheck(report, index, {
      ...report.checks[index],
      artifacts,
      completedAt,
      durationMs,
      effectiveTimeoutMs,
      errorCode: cleanupError ? "COMMAND_OUTPUT_CLEANUP_FAILED" : result.errorCode,
      errorMessage: cleanupError ?? result.errorMessage,
      exitCode: result.status,
      failureReason: interruptionSignal
        ? `Release spine evidence was interrupted by ${interruptionSignal}.`
        : (cleanupError ?? failureReason(result, artifactReason)),
      signal: interruptionSignal ?? result.signal,
      status,
      stderrExcerpt: outputExcerpt(result.stderr, maxOutputExcerptLength),
      stdoutExcerpt: outputExcerpt(result.stdout, maxOutputExcerptLength),
    });
    checkpoint();
    if (interruptionSignal) {
      report = markReportInterrupted(report, interruptionSignal, completedAt);
      checkpoint();
      break;
    }
  }

  report = finishReport(report, clock.nowIso());
  checkpoint();
  return report;
}

export function reuseTestEvidence(
  commands: readonly EvidenceCommand[],
  inputPath: string,
  commitSha: string,
  profile = "spine",
  rootDir = process.cwd(),
): readonly EvidenceCommand[] {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
    assertTestEvidenceBundle(value);
  } catch (error) {
    throw new VerificationProblem(
      "INVALID_TEST_EVIDENCE_INPUT",
      "input",
      `Unable to read a valid croco.test-evidence/v1 bundle from ${inputPath}. Cause: ${errorMessage(error)}`,
    );
  }
  if (value.status !== "passed" || value.missingArtifacts.length > 0) {
    throw new VerificationProblem(
      "INVALID_TEST_EVIDENCE_INPUT",
      "input",
      `--test-evidence requires a passed croco.test-evidence/v1 bundle without missing artifacts: ${inputPath}`,
    );
  }
  const records = value.records;
  return commands.map((command) => {
    const requiredArtifacts = (command.artifacts ?? [])
      .filter(({ required }) => required)
      .map(({ path }) => path);
    const record = records.find(
      (candidate) =>
        candidate.runner === "croco-verification" &&
        candidate.outcome === "passed" &&
        candidate.observed.contractIds.includes(command.id) &&
        candidate.metadata?.commitSha === commitSha &&
        candidate.metadata?.profile === profile &&
        candidate.replay.command === command.command.join(" ") &&
        requiredArtifacts.every(
          (path) =>
            candidate.attachments.some((attachment) => attachment.path === path) &&
            existsSync(resolve(rootDir, path)),
        ),
    );
    return record
      ? { ...command, reusedEvidence: { path: inputPath, recordId: record.id } }
      : command;
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
    `- Profile: \`${report.profile}\``,
    `- Commit: \`${report.provenance.commitSha}\``,
    `- Run: \`${report.provenance.runId}\` attempt \`${report.provenance.runAttempt}\``,
    `- Total timeout: ${formatTimeout(report.totalTimeoutMs)}`,
    `- Checks: ${report.summary.passed}/${report.summary.total} passed, ${report.summary.notApplicable} not applicable, ${report.summary.failed} failed, ${report.summary.timedOut} timed out, ${report.summary.interrupted} interrupted, ${report.summary.skippedAfterTimeout} skipped after timeout`,
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
      `- Selection reason: ${check.selectionReason ?? "Always selected by this verification profile."}`,
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
  writeFileSync(join(outputDir, REPORT_JSON_FILE_NAME), `${JSON.stringify(summarized, null, 2)}\n`);
  writeFileSync(
    join(outputDir, REPORT_MARKDOWN_FILE_NAME),
    buildReleaseSpineEvidenceMarkdown(summarized),
  );
  return summarized;
}

export function failedCheckDiagnostics(report: ReleaseSpineEvidenceReport): readonly string[] {
  return report.checks
    .filter(
      ({ status }) =>
        status === "failed" ||
        status === "timed_out" ||
        status === "interrupted" ||
        status === "skipped_after_timeout",
    )
    .map(({ errorMessage, failureReason, id, status, stderrExcerpt }) => {
      const details = [failureReason, errorMessage, stderrExcerpt.trim()]
        .filter(Boolean)
        .join(" | ");
      return `${id}: ${status}${details ? `: ${details}` : ""}`;
    });
}

function parsePositiveInteger(value: string, flag: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new VerificationProblem(
      "INVALID_POSITIVE_INTEGER",
      "input",
      `${flag} must be a positive integer`,
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new VerificationProblem(
      "INVALID_POSITIVE_INTEGER",
      "input",
      `${flag} must be a positive integer`,
    );
  }

  return parsed;
}

export function parseArgs(args: readonly string[] = argv.slice(2)): Options {
  let rootDir = process.cwd();
  let outputDir = join(rootDir, DEFAULT_OUTPUT_DIRECTORY);
  let outputDirWasExplicit = false;
  let totalTimeoutMs = DEFAULT_TOTAL_TIMEOUT_MS;
  let profile: VerificationProfile = "spine";
  let profileWasExplicit = false;
  let base: string | undefined;
  let head: string | undefined;
  let allowPendingReleaseMetadata = false;
  let testEvidencePath: string | undefined;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }

    if (arg === "--allow-pending-release-metadata") {
      allowPendingReleaseMetadata = true;
      continue;
    }

    if (arg === "--test-evidence") {
      const value = args[index + 1];
      if (!value) {
        throw new VerificationProblem(
          "MISSING_TEST_EVIDENCE_PATH",
          "input",
          "--test-evidence requires a path",
        );
      }
      testEvidencePath = value;
      index++;
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new VerificationProblem("MISSING_ROOT_PATH", "input", "--root requires a path");
      }
      rootDir = resolve(value);
      if (!outputDirWasExplicit) {
        outputDir =
          profile === "spine"
            ? join(rootDir, DEFAULT_OUTPUT_DIRECTORY)
            : join(rootDir, "ci-reports", "verification", profile);
      }
      index++;
      continue;
    }

    if (arg === "--output-dir") {
      const value = args[index + 1];
      if (!value) {
        throw new VerificationProblem(
          "MISSING_OUTPUT_DIRECTORY",
          "input",
          "--output-dir requires a path",
        );
      }
      outputDir = resolve(value);
      outputDirWasExplicit = true;
      index++;
      continue;
    }

    if (arg === "--total-timeout-ms") {
      const value = args[index + 1];
      if (!value) {
        throw new VerificationProblem(
          "MISSING_TOTAL_TIMEOUT",
          "input",
          "--total-timeout-ms requires a value",
        );
      }
      totalTimeoutMs = parsePositiveInteger(value, "--total-timeout-ms");
      index++;
      continue;
    }

    if (arg === "--profile") {
      if (profileWasExplicit) {
        throw new VerificationProblem(
          "DUPLICATE_VERIFICATION_PROFILE",
          "input",
          "--profile may be provided only once",
        );
      }
      const value = args[index + 1];
      if (value !== "repo" && value !== "spine" && value !== "publish") {
        throw new VerificationProblem(
          "INVALID_VERIFICATION_PROFILE",
          "input",
          "--profile must be repo, spine, or publish",
        );
      }
      profile = value;
      profileWasExplicit = true;
      if (!outputDirWasExplicit && profile !== "spine") {
        outputDir = join(rootDir, "ci-reports", "verification", profile);
      }
      index++;
      continue;
    }

    if (arg === "--base" || arg === "--head") {
      const value = args[index + 1];
      if (!value) {
        throw new VerificationProblem(
          "MISSING_VERIFICATION_REVISION",
          "input",
          `${arg} requires a revision`,
        );
      }
      if (arg === "--base") base = value;
      else head = value;
      index++;
      continue;
    }

    throw new VerificationProblem("UNKNOWN_VERIFICATION_OPTION", "input", `Unknown option: ${arg}`);
  }

  return {
    allowPendingReleaseMetadata,
    rootDir: resolve(rootDir),
    outputDir: resolve(outputDir),
    totalTimeoutMs,
    profile,
    base,
    head,
    testEvidencePath,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));
  const profile = options.profile ?? "spine";
  const commands = createVerificationManifest(profile, {
    allowPendingReleaseMetadata: options.allowPendingReleaseMetadata,
    base: options.base,
    changedFiles: readChangedFiles(options.rootDir, options.base, options.head),
    head: options.head,
  });
  let interruptSignal: NodeJS.Signals | null = null;
  const interrupt = (signal: string) => {
    interruptSignal = signal as NodeJS.Signals;
    interruptActiveCommand(interruptSignal);
    console.error(`release-spine-evidence: interrupted by ${signal}`);
  };

  process.once("SIGINT", () => interrupt("SIGINT"));
  process.once("SIGTERM", () => interrupt("SIGTERM"));

  const report = await runReleaseSpineEvidence({
    ...options,
    commands,
    getInterruptSignal: () => interruptSignal,
  });

  console.log(
    `release-spine-evidence: wrote ${join(options.outputDir, REPORT_MARKDOWN_FILE_NAME)}`,
  );
  console.log(`release-spine-evidence: wrote ${join(options.outputDir, REPORT_JSON_FILE_NAME)}`);
  console.log(
    `release-spine-evidence: status=${report.status} passed=${report.summary.passed}/${report.summary.total}`,
  );
  for (const diagnostic of failedCheckDiagnostics(report)) {
    console.error(`release-spine-evidence: check failed: ${diagnostic}`);
  }

  exit(
    interruptSignal
      ? interruptSignal === "SIGINT"
        ? 130
        : 143
      : report.status === "passed"
        ? 0
        : 1,
  );
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(`release-spine-evidence: failed: ${formatVerificationProblem(error)}`);
    exit(1);
  });
}

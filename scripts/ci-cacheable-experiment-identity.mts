#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import { parseExperimentIdentity } from "./ci-lane-evidence.mts";
import { inventoryDigest, readTestInventory } from "./test-inventory.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";
import type { ExperimentIdentity, VerificationProfile } from "./ci-lane-evidence.mts";

export type CacheableExperimentIdentityInput = {
  readonly commitSha: string;
  readonly runId: string;
  readonly runAttempt: number;
  readonly profile: VerificationProfile;
  readonly runnerOs: string;
  readonly runnerArch: string;
  readonly runnerLabel: string;
  readonly nodeVersion: string;
  readonly pnpmVersion: string;
  readonly turboVersion: string;
  readonly packageManager: string;
  readonly workflowDigest: string;
  readonly inventoryDigest: string;
  readonly inventoryFileDigest: string;
  readonly baseSha?: string;
  readonly changedFilesDigest?: string;
};

export function digestParts(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function digestFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER_BYTES = 16 * 1024 * 1024;

function gitOutput(
  rootDir: string,
  args: readonly string[],
  code: string,
  operation: string,
): string {
  try {
    return execFileSync("git", args, {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: GIT_TIMEOUT_MS,
    });
  } catch (error) {
    throw new VerificationProblem(
      code,
      "input",
      `${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function resolveCommitSha(rootDir: string, ref: string): string {
  return gitOutput(
    rootDir,
    ["rev-parse", `${ref}^{commit}`],
    "COMMIT_SHA_RESOLUTION_FAILED",
    `Resolving commit ${ref}`,
  ).trim();
}

export function readChangedFiles(
  rootDir: string,
  baseSha: string,
  headSha: string,
): readonly string[] {
  return gitOutput(
    rootDir,
    ["diff", "--name-only", baseSha, headSha],
    "CHANGED_FILES_RESOLUTION_FAILED",
    `Reading changed files for ${baseSha}..${headSha}`,
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
}

export function changedFilesDigest(changedFiles: readonly string[]): string {
  return digestParts([...changedFiles].sort());
}

export function cacheableInputDigest(input: {
  readonly commitSha: string;
  readonly workflowDigest: string;
  readonly inventoryFileDigest: string;
  readonly toolchainDigest: string;
  readonly baseSha?: string;
  readonly changedFilesDigest?: string;
}): string {
  if ((input.baseSha === undefined) !== (input.changedFilesDigest === undefined)) {
    throw new VerificationProblem(
      "INCOMPLETE_CHANGE_IDENTITY",
      "input",
      "baseSha and changedFilesDigest must be provided together",
    );
  }
  return digestParts([
    input.commitSha,
    input.workflowDigest,
    input.inventoryFileDigest,
    input.toolchainDigest,
    ...(input.baseSha && input.changedFilesDigest ? [input.baseSha, input.changedFilesDigest] : []),
  ]);
}

export function createCacheableExperimentIdentity(
  input: CacheableExperimentIdentityInput,
): ExperimentIdentity {
  const toolchainDigest = digestParts([
    input.runnerOs,
    input.runnerArch,
    input.runnerLabel,
    input.nodeVersion,
    input.pnpmVersion,
    input.turboVersion,
    input.packageManager,
  ]);
  const inputDigest = cacheableInputDigest({
    commitSha: input.commitSha,
    workflowDigest: input.workflowDigest,
    inventoryFileDigest: input.inventoryFileDigest,
    toolchainDigest,
    ...(input.baseSha && input.changedFilesDigest
      ? { baseSha: input.baseSha, changedFilesDigest: input.changedFilesDigest }
      : {}),
  });
  return parseExperimentIdentity({
    architectureVersion: "shadow-split",
    commitSha: input.commitSha,
    runId: input.runId,
    runAttempt: input.runAttempt,
    profile: input.profile,
    manifestDigest: input.workflowDigest,
    inventoryDigest: input.inventoryDigest,
    toolchainDigest,
    inputDigest,
    verificationExperimentId: `${input.runId}-${input.runAttempt}-${inputDigest.slice(0, 12)}`,
  });
}

function optionValue(args: readonly string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index === -1 ? undefined : args[index + 1];
}

function requiredOption(args: readonly string[], option: string): string {
  const value = optionValue(args, option);
  if (!value) {
    throw new VerificationProblem("MISSING_IDENTITY_OPTION", "input", `${option} requires a value`);
  }
  return value;
}

function positiveInteger(value: string, option: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new VerificationProblem(
      "INVALID_POSITIVE_INTEGER",
      "input",
      `${option} must be a positive integer`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new VerificationProblem(
      "INVALID_POSITIVE_INTEGER",
      "input",
      `${option} must be a positive integer`,
    );
  }
  return parsed;
}

function profile(value: string): VerificationProfile {
  if (value !== "repo" && value !== "spine" && value !== "publish") {
    throw new VerificationProblem(
      "UNKNOWN_VERIFICATION_PROFILE",
      "input",
      "--profile must be repo, spine, or publish",
    );
  }
  return value;
}

function packageMetadata(rootDir: string): {
  readonly packageManager: string;
  readonly turboVersion: string;
} {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")) as unknown;
  } catch (error) {
    throw new VerificationProblem(
      "INVALID_PACKAGE_METADATA",
      "configuration",
      `Unable to parse package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new VerificationProblem(
      "INVALID_PACKAGE_METADATA",
      "configuration",
      "package.json must contain an object",
    );
  }
  const metadata = value as Record<string, unknown>;
  const devDependencies = metadata.devDependencies;
  if (
    typeof metadata.packageManager !== "string" ||
    typeof devDependencies !== "object" ||
    devDependencies === null ||
    Array.isArray(devDependencies) ||
    typeof (devDependencies as Record<string, unknown>).turbo !== "string"
  ) {
    throw new VerificationProblem(
      "INVALID_PACKAGE_METADATA",
      "configuration",
      "package.json must declare packageManager and devDependencies.turbo",
    );
  }
  return {
    packageManager: metadata.packageManager,
    turboVersion: (devDependencies as Record<string, string>).turbo,
  };
}

export function createCacheableExperimentIdentityFromRepository(args: readonly string[]): {
  readonly identity: ExperimentIdentity;
  readonly outputPath?: string;
} {
  const rootDir = resolve(optionValue(args, "--root") ?? process.cwd());
  const workflowPath = resolve(
    rootDir,
    optionValue(args, "--workflow") ?? ".github/workflows/ci.yml",
  );
  const inventoryPath = resolve(rootDir, optionValue(args, "--inventory") ?? "test-inventory.json");
  const metadata = packageMetadata(rootDir);
  const runId = requiredOption(args, "--run-id");
  const runAttempt = positiveInteger(requiredOption(args, "--run-attempt"), "--run-attempt");
  const verificationProfile = profile(requiredOption(args, "--profile"));
  const baseRef = requiredOption(args, "--base");
  const headRef = requiredOption(args, "--head");
  const baseSha = resolveCommitSha(rootDir, baseRef);
  const headSha = resolveCommitSha(rootDir, headRef);
  const commitSha = requiredOption(args, "--commit-sha");
  if (headSha !== commitSha) {
    throw new VerificationProblem(
      "COMMIT_SHA_MISMATCH",
      "input",
      "--commit-sha must match the resolved --head commit",
    );
  }
  const changedFiles = readChangedFiles(rootDir, baseSha, headSha);
  const identity = createCacheableExperimentIdentity({
    commitSha,
    runId,
    runAttempt,
    profile: verificationProfile,
    runnerOs: requiredOption(args, "--runner-os"),
    runnerArch: requiredOption(args, "--runner-arch"),
    runnerLabel: requiredOption(args, "--runner-label"),
    nodeVersion: optionValue(args, "--node-version") ?? process.version,
    pnpmVersion: requiredOption(args, "--pnpm-version"),
    turboVersion: metadata.turboVersion,
    packageManager: metadata.packageManager,
    workflowDigest: digestFile(workflowPath),
    inventoryDigest: inventoryDigest(readTestInventory(inventoryPath).inventory),
    inventoryFileDigest: digestFile(inventoryPath),
    baseSha,
    changedFilesDigest: changedFilesDigest(changedFiles),
  });
  const output = optionValue(args, "--output");
  return { identity, ...(output ? { outputPath: resolve(rootDir, output) } : {}) };
}

function main(): void {
  const { identity, outputPath } = createCacheableExperimentIdentityFromRepository(argv.slice(2));
  const rendered = `${JSON.stringify(identity, null, 2)}\n`;
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, rendered);
  }
  process.stdout.write(rendered);
}

if (import.meta.url === pathToFileURL(resolve(argv[1] ?? "")).href) {
  try {
    main();
  } catch (error) {
    const problem =
      error instanceof VerificationProblem
        ? error
        : new VerificationProblem(
            "UNEXPECTED_FAILURE",
            "contract",
            error instanceof Error ? error.message : String(error),
          );
    console.error(`[ci-cacheable-experiment-identity] ${formatVerificationProblem(problem)}`);
    exit(1);
  }
}

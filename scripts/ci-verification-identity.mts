#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";

const FULL_COMMIT_OID = /^[0-9a-f]{40}$/i;
const NULL_COMMIT_OID = /^0{40}$/;
const GIT_TIMEOUT_MS = 30_000;

export type VerificationEventName = "pull_request" | "push" | "workflow_dispatch";

export type VerificationIdentity = {
  readonly schemaVersion: "croco.ci-verification-identity/v1";
  readonly eventName: VerificationEventName;
  readonly baseSha: string;
  readonly headSha: string;
  readonly candidateSha: string;
};

type ResolveVerificationIdentityOptions = {
  readonly rootDir: string;
  readonly eventName: VerificationEventName;
  readonly eventBaseSha?: string;
  readonly eventHeadSha?: string;
  readonly candidateRef: string;
  readonly checkoutRef?: string;
};

type AssertVerificationIdentityOptions = {
  readonly rootDir: string;
  readonly eventName: VerificationEventName;
  readonly baseSha: string;
  readonly headSha: string;
  readonly candidateSha: string;
  readonly checkoutRef: string;
  readonly verifyWorktree?: boolean;
};

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
      stdio: ["ignore", "pipe", "pipe"],
      timeout: GIT_TIMEOUT_MS,
    }).trim();
  } catch (error) {
    throw new VerificationProblem(
      code,
      "input",
      `${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function fullCommitOid(value: string | undefined, label: string): string {
  if (!value || !FULL_COMMIT_OID.test(value)) {
    throw new VerificationProblem(
      "INVALID_VERIFICATION_IDENTITY_OID",
      "input",
      `${label} must be a full 40-character commit OID`,
    );
  }
  return value.toLowerCase();
}

function resolveCommit(rootDir: string, ref: string, label: string): string {
  return fullCommitOid(
    gitOutput(
      rootDir,
      ["rev-parse", "--verify", `${ref}^{commit}`],
      "VERIFICATION_IDENTITY_COMMIT_MISSING",
      `Resolving ${label} ${ref}`,
    ),
    label,
  );
}

function assertPullRequestParents(
  rootDir: string,
  baseSha: string,
  headSha: string,
  candidateSha: string,
): void {
  const [commit, ...parents] = gitOutput(
    rootDir,
    ["rev-list", "--parents", "-n", "1", candidateSha],
    "VERIFICATION_CANDIDATE_PARENT_READ_FAILED",
    `Reading parents for merge candidate ${candidateSha}`,
  ).split(/\s+/);

  if (commit !== candidateSha || parents.length !== 2) {
    throw new VerificationProblem(
      "VERIFICATION_CANDIDATE_PARENT_COUNT_MISMATCH",
      "contract",
      `Pull-request candidate ${candidateSha} must be a two-parent merge commit`,
    );
  }
  if (parents[0] !== baseSha || parents[1] !== headSha) {
    throw new VerificationProblem(
      "VERIFICATION_CANDIDATE_PARENT_MISMATCH",
      "contract",
      `Pull-request candidate ${candidateSha} parents must equal base ${baseSha} and head ${headSha} in that order`,
    );
  }
}

export function assertVerificationIdentity(
  options: AssertVerificationIdentityOptions,
): VerificationIdentity {
  const baseSha = fullCommitOid(options.baseSha, "base SHA");
  const headSha = fullCommitOid(options.headSha, "head SHA");
  const candidateSha = fullCommitOid(options.candidateSha, "candidate SHA");

  for (const [label, sha] of [
    ["base", baseSha],
    ["head", headSha],
    ["candidate", candidateSha],
  ] as const) {
    const resolved = resolveCommit(options.rootDir, sha, `${label} SHA`);
    if (resolved !== sha) {
      throw new VerificationProblem(
        "VERIFICATION_IDENTITY_COMMIT_MISMATCH",
        "contract",
        `${label} SHA ${sha} resolved to ${resolved}`,
      );
    }
  }

  const checkoutSha = resolveCommit(options.rootDir, options.checkoutRef, "checked revision");
  if (checkoutSha !== candidateSha) {
    throw new VerificationProblem(
      "VERIFICATION_CANDIDATE_CHECKOUT_MISMATCH",
      "contract",
      `Checked revision ${checkoutSha} does not match candidate ${candidateSha}`,
    );
  }
  if (
    options.verifyWorktree &&
    gitOutput(
      options.rootDir,
      ["status", "--porcelain=v1", "--untracked-files=no"],
      "VERIFICATION_CANDIDATE_WORKTREE_READ_FAILED",
      "Reading tracked candidate worktree status",
    ).length > 0
  ) {
    throw new VerificationProblem(
      "VERIFICATION_CANDIDATE_WORKTREE_MISMATCH",
      "contract",
      `Tracked index and worktree must match candidate ${candidateSha}`,
    );
  }

  if (options.eventName === "pull_request") {
    assertPullRequestParents(options.rootDir, baseSha, headSha, candidateSha);
  } else if (headSha !== candidateSha) {
    throw new VerificationProblem(
      "NON_PULL_REQUEST_HEAD_CANDIDATE_MISMATCH",
      "contract",
      `Non-pull-request head ${headSha} must match candidate ${candidateSha}`,
    );
  }

  return {
    schemaVersion: "croco.ci-verification-identity/v1",
    eventName: options.eventName,
    baseSha,
    headSha,
    candidateSha,
  };
}

export function resolveVerificationIdentity(
  options: ResolveVerificationIdentityOptions,
): VerificationIdentity {
  const candidateSha = resolveCommit(options.rootDir, options.candidateRef, "candidate ref");
  const headSha =
    options.eventName === "pull_request"
      ? fullCommitOid(options.eventHeadSha, "event head SHA")
      : options.eventHeadSha && FULL_COMMIT_OID.test(options.eventHeadSha)
        ? fullCommitOid(options.eventHeadSha, "event head SHA")
        : candidateSha;

  const usableEventBase =
    options.eventBaseSha !== undefined &&
    FULL_COMMIT_OID.test(options.eventBaseSha) &&
    !NULL_COMMIT_OID.test(options.eventBaseSha);
  if (!usableEventBase && options.eventName === "pull_request") {
    throw new VerificationProblem(
      "INVALID_VERIFICATION_IDENTITY_OID",
      "input",
      "Pull-request event base SHA must be a full non-null 40-character commit OID",
    );
  }
  const baseSha = usableEventBase
    ? fullCommitOid(options.eventBaseSha, "event base SHA")
    : resolveCommit(options.rootDir, `${candidateSha}^`, "candidate parent");

  return assertVerificationIdentity({
    rootDir: options.rootDir,
    eventName: options.eventName,
    baseSha,
    headSha,
    candidateSha,
    checkoutRef: options.checkoutRef ?? "HEAD",
  });
}

function optionValue(args: readonly string[], option: string): string | undefined {
  const index = args.indexOf(option);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value === undefined || value.startsWith("-") ? undefined : value;
}

function requiredOption(args: readonly string[], option: string): string {
  const value = optionValue(args, option);
  if (!value) {
    throw new VerificationProblem(
      "MISSING_VERIFICATION_IDENTITY_OPTION",
      "input",
      `${option} requires a value`,
    );
  }
  return value;
}

function eventName(value: string): VerificationEventName {
  if (value !== "pull_request" && value !== "push" && value !== "workflow_dispatch") {
    throw new VerificationProblem(
      "INVALID_VERIFICATION_IDENTITY_EVENT",
      "input",
      "--event must be pull_request, push, or workflow_dispatch",
    );
  }
  return value;
}

function writeIdentity(identity: VerificationIdentity, args: readonly string[]): void {
  const rendered = `${JSON.stringify(identity, null, 2)}\n`;
  const output = optionValue(args, "--output");
  if (output) {
    const outputPath = resolve(optionValue(args, "--root") ?? process.cwd(), output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, rendered);
  }
  const githubOutput = optionValue(args, "--github-output");
  if (githubOutput) {
    writeFileSync(
      githubOutput,
      `base=${identity.baseSha}\nhead=${identity.headSha}\ncandidate=${identity.candidateSha}\n`,
      { flag: "a" },
    );
  }
  process.stdout.write(rendered);
}

function main(): void {
  const args = argv.slice(2);
  const command = args[0];
  const rootDir = resolve(optionValue(args, "--root") ?? process.cwd());
  const selectedEvent = eventName(requiredOption(args, "--event"));

  if (command === "resolve") {
    writeIdentity(
      resolveVerificationIdentity({
        rootDir,
        eventName: selectedEvent,
        eventBaseSha: optionValue(args, "--event-base"),
        eventHeadSha: optionValue(args, "--event-head"),
        candidateRef: requiredOption(args, "--candidate"),
        checkoutRef: optionValue(args, "--checkout") ?? "HEAD",
      }),
      args,
    );
    return;
  }
  if (command === "assert") {
    writeIdentity(
      assertVerificationIdentity({
        rootDir,
        eventName: selectedEvent,
        baseSha: requiredOption(args, "--base"),
        headSha: requiredOption(args, "--head"),
        candidateSha: requiredOption(args, "--candidate"),
        checkoutRef: optionValue(args, "--checkout") ?? "HEAD",
        verifyWorktree: args.includes("--worktree"),
      }),
      args,
    );
    return;
  }
  throw new VerificationProblem(
    "INVALID_VERIFICATION_IDENTITY_COMMAND",
    "input",
    "Expected resolve or assert command",
  );
}

if (import.meta.url === pathToFileURL(resolve(argv[1] ?? "")).href) {
  try {
    main();
  } catch (error) {
    const problem =
      error instanceof VerificationProblem
        ? error
        : new VerificationProblem(
            "UNEXPECTED_VERIFICATION_IDENTITY_FAILURE",
            "contract",
            error instanceof Error ? error.message : String(error),
          );
    console.error(`[ci-verification-identity] ${formatVerificationProblem(problem)}`);
    exit(1);
  }
}

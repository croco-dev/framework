#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";

import { verificationImplementationPaths } from "./verification-manifest.mts";
import { isReleaseGateMaintenancePath } from "./release-gate-maintenance.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";
import type { VerificationProfile } from "./verification-manifest.mts";

export type VerificationEvent = "pull_request" | "push" | "workflow_dispatch";
export type VerificationWorkflow = "ci" | "release";

export type VerificationClassification = {
  readonly allowPendingReleaseMetadata: boolean;
  readonly profile: VerificationProfile | null;
  readonly shouldRunVerification: boolean;
  readonly shouldUpdateReleasePr: boolean;
  readonly shouldRunChangesetsAction: boolean;
  readonly reason: string;
};

type PathKind = "repo" | "spine" | "publish" | "changeset" | "unknown-release";

const PROFILE_STRENGTH: Record<VerificationProfile, number> = { repo: 1, spine: 2, publish: 3 };
const MANIFEST_IMPLEMENTATION_PATHS = new Set(verificationImplementationPaths());

function classifyPath(path: string): PathKind {
  if (isReleaseGateMaintenancePath(path)) return "publish";
  if (path === ".changeset/README.md") return "repo";
  if (path === ".changeset/config.json") return "publish";
  if (/^\.changeset\/(pre\.json|[^/]+\.md)$/.test(path)) return "changeset";
  if (/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/.test(path)) return "publish";
  if (path === "test-inventory.json") return "publish";
  if (/^packages\/[^/]+\/(package\.json|CHANGELOG\.md)$/.test(path)) return "publish";
  if (
    /^packages\/[^/]+\/(src|tests?|test|config)\//.test(path) ||
    /^packages\/[^/]+\/tsconfig[^/]*\.json$/.test(path)
  )
    return "spine";
  if (
    /^(?:README\.md|RELEASING\.md|CONTRIBUTING\.md|AGENTS\.md|LICENSE)$/.test(path) ||
    path.startsWith("docs/") ||
    /^packages\/[^/]+\/README\.md$/.test(path)
  )
    return "repo";
  if (
    /^(turbo\.json|vitest(?:\.[^/]+)?\.ts|tsconfig(?:\.[^/]+)?\.json|\.nvmrc|croco\.arch\.json)$/.test(
      path,
    )
  )
    return "spine";
  if (
    path === ".github/actionlint.yaml" ||
    path === ".github/renovate.json" ||
    path.startsWith(".github/workflows/")
  )
    return "publish";
  if (MANIFEST_IMPLEMENTATION_PATHS.has(path)) return "publish";
  if (
    /^scripts\/(verification-[^/]+|workflow-verification-contract|release-spine-evidence)\.mts$/.test(
      path,
    )
  )
    return "publish";
  if (
    /^scripts\/tests\/(verification-manifest|verification-change-classifier|verification-command|provenance-config-check|ci-executable-policy|release-spine-evidence|ci-workflow|release-workflow)\.spec\.ts$/.test(
      path,
    )
  )
    return "publish";
  if (
    /^scripts\/(release|alpha-release|dependency-audit|package-quality|provider-certification|production-ready|spine-promotion|public-api|changeset-required)/.test(
      path,
    )
  )
    return "publish";
  if (
    /^(\.changeset\/|scripts\/(release|verification|provenance|dependency-audit)|packages\/[^/]+\/(package[^/]*|CHANGELOG))/.test(
      path,
    )
  )
    return "unknown-release";
  if (/^scripts\/(tests\/)?[^/]+\.(mts|mjs|ts)$/.test(path)) return "spine";
  if (/^(packages|apps|examples)\//.test(path)) return "spine";
  return "spine";
}

export function classifyVerificationChanges(
  event: VerificationEvent,
  changedFiles: readonly string[],
  workflow: VerificationWorkflow = "release",
): VerificationClassification {
  if (event === "workflow_dispatch") {
    return {
      allowPendingReleaseMetadata: workflow === "ci",
      profile: "publish",
      shouldRunVerification: true,
      shouldUpdateReleasePr: workflow === "release",
      shouldRunChangesetsAction: workflow === "release",
      reason: workflow === "ci" ? "manual CI dispatch" : "manual release dispatch",
    };
  }

  const kinds = changedFiles.map((path) => ({ path, kind: classifyPath(path) }));
  const unknown = kinds.find(({ kind }) => kind === "unknown-release");
  if (unknown) {
    throw new VerificationProblem(
      "UNCLASSIFIED_RELEASE_PATH",
      "contract",
      `Unclassified release-adjacent path: ${unknown.path}`,
    );
  }

  const hasChangeset = kinds.some(({ kind }) => kind === "changeset");
  const strongest = kinds.reduce<VerificationProfile | null>((profile, { kind }) => {
    if (kind === "changeset") return profile ?? "repo";
    const candidate = kind as VerificationProfile;
    return !profile || PROFILE_STRENGTH[candidate] > PROFILE_STRENGTH[profile]
      ? candidate
      : profile;
  }, null);

  if (workflow === "ci") {
    const ciProfile = strongest ?? "repo";
    return {
      allowPendingReleaseMetadata: true,
      profile: ciProfile,
      shouldRunVerification: true,
      shouldUpdateReleasePr: false,
      shouldRunChangesetsAction: false,
      reason: `${event} changes require ${ciProfile} CI verification`,
    };
  }

  if (event === "pull_request") {
    return {
      allowPendingReleaseMetadata: true,
      profile: strongest ?? "repo",
      shouldRunVerification: true,
      shouldUpdateReleasePr: false,
      shouldRunChangesetsAction: false,
      reason: `pull request changes require ${strongest ?? "repo"} verification`,
    };
  }

  const hasPublishCandidate = kinds.some(
    ({ kind, path }) =>
      kind === "publish" &&
      (/^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/.test(path) ||
        /^packages\/[^/]+\/(package\.json|CHANGELOG\.md)$/.test(path)),
  );
  const hasMaintenance = kinds.some(({ kind }) => kind === "publish") && !hasPublishCandidate;
  const profile = hasPublishCandidate || hasMaintenance ? "publish" : null;
  return {
    allowPendingReleaseMetadata: hasMaintenance && !hasPublishCandidate,
    profile,
    shouldRunVerification: profile !== null,
    shouldUpdateReleasePr: hasChangeset,
    shouldRunChangesetsAction: hasChangeset || hasPublishCandidate,
    reason: hasPublishCandidate
      ? "publish candidate requires publish verification and Changesets action"
      : hasMaintenance
        ? "release-gate maintenance requires publish verification"
        : hasChangeset
          ? "raw changeset updates the Version Packages pull request without publish verification"
          : "no release work detected",
  };
}

type CliOptions = {
  readonly event: VerificationEvent;
  readonly workflow: VerificationWorkflow;
  readonly base?: string;
  readonly head?: string;
  readonly githubOutput?: string;
};

function parseArgs(args: readonly string[]): CliOptions {
  let event: VerificationEvent = "pull_request";
  let workflow: VerificationWorkflow = "release";
  let base: string | undefined;
  let head: string | undefined;
  let githubOutput: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      flag === "--event" &&
      (value === "pull_request" || value === "push" || value === "workflow_dispatch")
    ) {
      event = value;
      index++;
      continue;
    }
    if (flag === "--workflow" && (value === "ci" || value === "release")) {
      workflow = value;
      index++;
      continue;
    }
    if (flag === "--base" && value) {
      base = value;
      index++;
      continue;
    }
    if (flag === "--head" && value) {
      head = value;
      index++;
      continue;
    }
    if (flag === "--github-output" && value) {
      githubOutput = value;
      index++;
      continue;
    }
    throw new VerificationProblem(
      "INVALID_VERIFICATION_CLASSIFIER_OPTION",
      "input",
      `Unknown or incomplete option: ${flag}`,
    );
  }
  return { event, workflow, base, head, githubOutput };
}

function changedFiles(base: string, head: string): readonly string[] {
  return execFileSync("git", ["diff", "--name-only", base, head], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
}

function main(): void {
  const options = parseArgs(argv.slice(2));
  const files =
    options.event === "workflow_dispatch"
      ? []
      : changedFiles(options.base ?? "HEAD^", options.head ?? "HEAD");
  const result = classifyVerificationChanges(options.event, files, options.workflow);
  const outputs = {
    allow_pending_release_metadata: String(result.allowPendingReleaseMetadata),
    profile: result.profile ?? "",
    should_run_verification: String(result.shouldRunVerification),
    should_update_release_pr: String(result.shouldUpdateReleasePr),
    should_run_changesets_action: String(result.shouldRunChangesetsAction),
    reason: result.reason,
  };
  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  console.log(lines);
  if (options.githubOutput) appendFileSync(options.githubOutput, `${lines}\n`);
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(`verification-change-classifier: failed: ${formatVerificationProblem(error)}`);
    process.exitCode = 1;
  }
}

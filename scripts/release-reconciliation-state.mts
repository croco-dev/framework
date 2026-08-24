#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";

export type PublishableWorkspacePackage = {
  readonly name: string;
  readonly version: string;
  readonly registry: string;
};

export type ReleaseReconciliationState = {
  readonly hasPendingChangesets: boolean;
  readonly shouldRunChangesetsAction: boolean;
  readonly shouldRunVerification: boolean;
  readonly unpublishedPackages: readonly string[];
};

type CliOptions = {
  readonly classifiedChangesetsAction: boolean;
  readonly classifiedVerification: boolean;
  readonly githubOutput?: string;
};

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const DEFAULT_NPM_REGISTRY = "https://registry.npmjs.org";
const REGISTRY_CONCURRENCY = 20;
const REGISTRY_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBoolean(value: string | undefined, flag: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${flag} must be true or false.`);
}

function parseArgs(args: readonly string[]): CliOptions {
  let classifiedChangesetsAction: boolean | undefined;
  let classifiedVerification: boolean | undefined;
  let githubOutput: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === "--classified-verification" && value !== undefined) {
      classifiedVerification = parseBoolean(value, flag);
      index++;
      continue;
    }
    if (flag === "--classified-changesets-action" && value !== undefined) {
      classifiedChangesetsAction = parseBoolean(value, flag);
      index++;
      continue;
    }
    if (flag === "--github-output" && value) {
      githubOutput = value;
      index++;
      continue;
    }
    throw new Error(`Unknown or incomplete option: ${flag}`);
  }
  if (classifiedVerification === undefined) {
    throw new Error("--classified-verification is required.");
  }
  if (classifiedChangesetsAction === undefined) {
    throw new Error("--classified-changesets-action is required.");
  }
  return { classifiedChangesetsAction, classifiedVerification, githubOutput };
}

function packageRegistry(packageJson: Record<string, unknown>): string {
  const publishConfig = isRecord(packageJson.publishConfig) ? packageJson.publishConfig : null;
  const registry = publishConfig?.registry;
  if (registry === undefined) return DEFAULT_NPM_REGISTRY;
  if (typeof registry !== "string" || !registry.startsWith("https://")) {
    throw new Error(`Package ${String(packageJson.name)} has an invalid publishConfig.registry.`);
  }
  return registry.replace(/\/+$/, "");
}

export function readPublishableWorkspacePackages(
  rootDir: string,
): readonly PublishableWorkspacePackage[] {
  const raw = execFileSync("pnpm", ["list", "--recursive", "--depth", "-1", "--json"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error("pnpm workspace list must be a JSON array.");

  const packages: PublishableWorkspacePackage[] = [];
  for (const row of rows) {
    if (!isRecord(row) || row.private !== false) continue;
    if (
      typeof row.name !== "string" ||
      typeof row.version !== "string" ||
      typeof row.path !== "string"
    ) {
      throw new Error("Public pnpm workspace entries must include name, version, and path.");
    }
    const relativePath = relative(rootDir, row.path);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error(`Workspace package ${row.name} resolves outside the repository.`);
    }
    const packageJson: unknown = JSON.parse(
      readFileSync(resolve(row.path, "package.json"), "utf8"),
    );
    if (!isRecord(packageJson)) {
      throw new Error(`Workspace package ${row.name} has an invalid package.json.`);
    }
    packages.push({
      name: row.name,
      version: row.version,
      registry: packageRegistry(packageJson),
    });
  }
  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

function packageVersionUrl(pkg: PublishableWorkspacePackage): string {
  return `${pkg.registry}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`;
}

async function hasPublishedVersion(
  pkg: PublishableWorkspacePackage,
  fetchImplementation: FetchImplementation,
): Promise<boolean> {
  const response = await fetchImplementation(packageVersionUrl(pkg), {
    headers: {
      accept: "application/vnd.npm.install-v1+json",
      "user-agent": "croco-release-reconciliation",
    },
    redirect: "error",
    signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
  });
  await response.body?.cancel();
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(
    `Registry lookup for ${pkg.name}@${pkg.version} returned HTTP ${response.status}.`,
  );
}

export async function findUnpublishedPackages(
  packages: readonly PublishableWorkspacePackage[],
  fetchImplementation: FetchImplementation = fetch,
): Promise<readonly string[]> {
  const unpublished: string[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(REGISTRY_CONCURRENCY, packages.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < packages.length) {
        const index = nextIndex;
        nextIndex++;
        const pkg = packages[index];
        if (!pkg) continue;
        if (!(await hasPublishedVersion(pkg, fetchImplementation))) {
          unpublished.push(`${pkg.name}@${pkg.version}`);
        }
      }
    }),
  );
  return unpublished.sort((left, right) => left.localeCompare(right));
}

export function hasPendingChangesets(rootDir: string): boolean {
  return readdirSync(resolve(rootDir, ".changeset"), { withFileTypes: true }).some(
    (entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md",
  );
}

export async function resolveReleaseReconciliationState(
  classifiedVerification: boolean,
  classifiedChangesetsAction: boolean,
  pendingChangesets: boolean,
  packages: readonly PublishableWorkspacePackage[],
  fetchImplementation: FetchImplementation = fetch,
): Promise<ReleaseReconciliationState> {
  if (classifiedVerification && classifiedChangesetsAction) {
    return {
      hasPendingChangesets: pendingChangesets,
      shouldRunChangesetsAction: true,
      shouldRunVerification: true,
      unpublishedPackages: [],
    };
  }
  const unpublishedPackages = await findUnpublishedPackages(packages, fetchImplementation);
  return {
    hasPendingChangesets: pendingChangesets,
    shouldRunChangesetsAction:
      classifiedChangesetsAction || pendingChangesets || unpublishedPackages.length > 0,
    shouldRunVerification:
      classifiedVerification || (unpublishedPackages.length > 0 && !pendingChangesets),
    unpublishedPackages,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));
  const packages =
    options.classifiedVerification && options.classifiedChangesetsAction
      ? []
      : readPublishableWorkspacePackages(process.cwd());
  const state = await resolveReleaseReconciliationState(
    options.classifiedVerification,
    options.classifiedChangesetsAction,
    hasPendingChangesets(process.cwd()),
    packages,
  );
  const unpublishedPackages = JSON.stringify(state.unpublishedPackages);
  console.log(`has_pending_changesets=${state.hasPendingChangesets}`);
  console.log(`should_run_changesets_action=${state.shouldRunChangesetsAction}`);
  console.log(`should_run_verification=${state.shouldRunVerification}`);
  console.log(`unpublished_packages=${unpublishedPackages}`);
  if (options.githubOutput) {
    appendFileSync(
      options.githubOutput,
      `has_pending_changesets=${state.hasPendingChangesets}\nshould_run_changesets_action=${state.shouldRunChangesetsAction}\nshould_run_verification=${state.shouldRunVerification}\nunpublished_packages=${unpublishedPackages}\n`,
    );
  }
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`release-reconciliation-state: failed: ${message}`);
    process.exitCode = 1;
  });
}

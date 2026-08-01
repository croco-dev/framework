import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { createVerificationManifest } from "./verification-manifest.mts";

export type WorkflowCommandViolation = {
  readonly command: string;
  readonly line: number;
  readonly reason: string;
};

export type WorkflowPermissionViolation = {
  readonly path: string;
  readonly reason: string;
};

type RootScripts = Readonly<Record<string, string>>;

const GITLEAKS_PRODUCTION_COMMAND =
  'docker run --rm -v "$PWD:/repo" "${{ env.GITLEAKS_IMAGE }}" detect --source /repo --redact --no-banner --log-opts=HEAD --report-format sarif --report-path /repo/ci-reports/security/gitleaks.sarif > ci-reports/security/gitleaks.txt 2>&1';
const GITLEAKS_RENOVATE_DIRECTIVE =
  "# renovate: datasource=docker depName=ghcr.io/gitleaks/gitleaks";
export const TRUSTED_GITLEAKS_IMAGE =
  "ghcr.io/gitleaks/gitleaks:v8.23.0@sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e";
const ALLOWED_WRITE_PERMISSIONS = new Set([
  "benchmark.yml:jobs.benchmark:pull-requests",
  "release.yml:workflow:id-token",
]);

export const ACTIONS_ONLY_WORKFLOW_COMMAND_ALLOWLIST = [
  'node -e \'const fs = require("node:fs"); fs.writeFileSync("ci-reports/package-quality/spine-promotion-run.json", JSON.stringify({ commitSha: process.env.SPINE_PROMOTION_COMMIT_SHA, runId: process.env.SPINE_PROMOTION_RUN_ID, runAttempt: process.env.SPINE_PROMOTION_RUN_ATTEMPT, startedAt: new Date().toISOString() }, null, 2) + "\\n")\'',
  "node --experimental-strip-types scripts/verification-change-classifier.mts",
  "node --experimental-strip-types scripts/release-spine-evidence.mts",
  "node --experimental-strip-types scripts/security-gitleaks-smoke.mts --ensure-sarif ci-reports/security/gitleaks.sarif",
  "node --experimental-strip-types scripts/test-evidence-bundle.mts",
  "pnpm install --frozen-lockfile",
  "pnpm audit:prod",
  "pnpm build --filter=@croco/auth-drizzle...",
  "pnpm build --filter=@croco/credits-drizzle...",
  "pnpm build --filter=@croco/execution-drizzle...",
  "pnpm build --filter=@croco/membership-drizzle...",
  "pnpm build --filter=@croco/metering-core...",
  "pnpm build --filter=@croco/testing-resources...",
  "pnpm security:gitleaks-smoke",
  "pnpm --filter @croco/auth-drizzle exec vitest run src/tests/DrizzleApiKeyStore.postgres.spec.ts",
  "pnpm --filter @croco/credits-drizzle test:postgres",
  "pnpm --filter @croco/execution-drizzle test:postgres",
  "pnpm --filter @croco/membership-drizzle exec vitest run src/tests/DrizzleMembershipStore.postgres.spec.ts",
  "pnpm --filter @croco/metering-core test:real",
  "pnpm --filter @croco/migration-runner exec vitest run src/tests/MigrationStatusPostgres.spec.ts",
  "pnpm --filter @croco/testing-resources test:real",
  "pnpm --filter @croco/testing test",
  "pnpm create-croco-app:smoke -- --tier ecosystem-advisory",
  "pnpm verify:publish",
  GITLEAKS_PRODUCTION_COMMAND,
] as const;

function splitShellCommands(command: string): readonly string[] {
  const segments: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < command.length; index++) {
    const character = command[index] ?? "";
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      current += character;
      escaped = true;
      continue;
    }
    if ((character === "'" || character === '"') && (!quote || quote === character)) {
      quote = quote ? null : character;
      current += character;
      continue;
    }
    const pair = command.slice(index, index + 2);
    if (!quote && (pair === "&&" || pair === "||")) {
      if (current.trim()) segments.push(current.trim());
      current = "";
      index++;
      continue;
    }
    if (!quote && character === ";") {
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function normalizeInvocation(command: string): string {
  return command
    .replace(/^if\s+(?:!\s+)?/, "")
    .replace(/^(?:(?:then|else|do|command|env)\s+)+/, "")
    .replace(/^(?:[A-Z_][A-Z0-9_]*=\S+\s+)+/, "")
    .replace(/^pnpm\s+run\s+/, "pnpm ")
    .trim();
}

function matchesArgvPrefix(command: string, allowed: string): boolean {
  if (allowed === GITLEAKS_PRODUCTION_COMMAND) {
    return command === allowed;
  }
  return command === allowed || command.startsWith(`${allowed} `);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function workflowName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function inspectPermissionScope(
  path: string,
  owner: string,
  permissions: Record<string, unknown>,
): readonly WorkflowPermissionViolation[] {
  const name = workflowName(path);
  const violations: WorkflowPermissionViolation[] = [];

  for (const [scope, access] of Object.entries(permissions)) {
    if (access !== "read" && access !== "write" && access !== "none") {
      violations.push({ path, reason: `${owner}.${scope} must be read, write, or none` });
      continue;
    }
    if (access === "write" && !ALLOWED_WRITE_PERMISSIONS.has(`${name}:${owner}:${scope}`)) {
      violations.push({ path, reason: `${owner}.${scope} grants unapproved write access` });
    }
  }

  return violations;
}

export function findWorkflowPermissionViolations(
  workflows: Readonly<Record<string, string>>,
): readonly WorkflowPermissionViolation[] {
  const violations: WorkflowPermissionViolation[] = [];

  for (const [path, source] of Object.entries(workflows).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    let workflow: unknown;
    try {
      workflow = parseYaml(source);
    } catch {
      violations.push({ path, reason: "workflow YAML could not be inspected" });
      continue;
    }

    if (!isPlainRecord(workflow)) {
      violations.push({ path, reason: "workflow must be a YAML object" });
      continue;
    }

    const topLevelPermissions = workflow.permissions;
    if (!isPlainRecord(topLevelPermissions)) {
      violations.push({ path, reason: "workflow must declare top-level permissions" });
    } else {
      if (topLevelPermissions.contents !== "read") {
        violations.push({ path, reason: "workflow permissions must grant contents: read" });
      }
      violations.push(...inspectPermissionScope(path, "workflow", topLevelPermissions));
    }

    if (!isPlainRecord(workflow.jobs)) {
      violations.push({ path, reason: "workflow must define jobs" });
      continue;
    }

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      if (!isPlainRecord(job)) {
        violations.push({ path, reason: `jobs.${jobName} must be a YAML object` });
        continue;
      }
      if (!isPlainRecord(topLevelPermissions) && !isPlainRecord(job.permissions)) {
        violations.push({
          path,
          reason: `jobs.${jobName} must declare permissions when the workflow does not`,
        });
      }
      if (job.permissions !== undefined && !isPlainRecord(job.permissions)) {
        violations.push({
          path,
          reason: `jobs.${jobName}.permissions must be an explicit permission map`,
        });
      }
      if (isPlainRecord(job.permissions)) {
        violations.push(...inspectPermissionScope(path, `jobs.${jobName}`, job.permissions));
      }
    }

    if (workflowName(path) === "ci.yml") {
      const changes = workflow.jobs.changes;
      const changesPermissions = isPlainRecord(changes) ? changes.permissions : null;
      if (
        !isPlainRecord(changesPermissions) ||
        changesPermissions.contents !== "read" ||
        changesPermissions["pull-requests"] !== "read"
      ) {
        violations.push({
          path,
          reason: "jobs.changes must grant contents: read and pull-requests: read",
        });
      }
    }
  }

  return violations;
}

export function findTrustedGitleaksImageViolations(workflowSource: string): readonly string[] {
  let workflow: unknown;
  try {
    workflow = parseYaml(workflowSource);
  } catch {
    return ["CI workflow YAML could not be inspected"];
  }

  if (!isPlainRecord(workflow) || !isPlainRecord(workflow.jobs)) {
    return ["CI workflow must define jobs"];
  }
  const validate = workflow.jobs.validate;
  const environment = isPlainRecord(validate) && isPlainRecord(validate.env) ? validate.env : null;
  const image = environment?.GITLEAKS_IMAGE;
  const violations: string[] = [];
  if (image !== TRUSTED_GITLEAKS_IMAGE) {
    violations.push("jobs.validate.env.GITLEAKS_IMAGE must be the digest-pinned trusted image");
  }

  const declarations = workflowSource
    .split(/\r?\n/)
    .map((line, index, lines) => ({ line: line.trim(), previous: lines[index - 1]?.trim() }))
    .filter(({ line }) => /^GITLEAKS_IMAGE\s*:/.test(line));
  if (declarations.length !== 1 || declarations[0]?.previous !== GITLEAKS_RENOVATE_DIRECTIVE) {
    violations.push(
      "the sole GITLEAKS_IMAGE declaration must be jobs.validate.env with its Renovate directive attached",
    );
  }
  return violations;
}

function readRootScripts(rootDir: string): RootScripts {
  const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")) as {
    readonly scripts?: RootScripts;
  };
  return packageJson.scripts ?? {};
}

function manifestArgvKeys(): readonly string[] {
  return createVerificationManifest("publish").map(({ command }) => command.join(" "));
}

function manifestOwnedAliases(rootDir: string): ReadonlySet<string> {
  const fingerprints = manifestArgvKeys();
  return new Set(
    Object.entries(readRootScripts(rootDir))
      .filter(
        ([, command]) =>
          command.includes("scripts/verification-command.mts --id ") ||
          fingerprints.some((fingerprint) => command.includes(fingerprint)),
      )
      .map(([alias]) => alias),
  );
}

function runCommands(
  workflow: string,
): readonly { readonly command: string; readonly line: number }[] {
  const lines = workflow.split("\n");
  const commands: { command: string; line: number }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index]?.match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1]?.length ?? 0;
    const inline = match[2]?.trim() ?? "";
    if (inline && inline !== "|" && inline !== ">-") {
      commands.push({ command: inline, line: index + 1 });
      continue;
    }
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex++) {
      const bodyLine = lines[bodyIndex] ?? "";
      if (bodyLine.trim() && bodyLine.search(/\S/) <= indent) break;
      const command = bodyLine.trim();
      if (command) commands.push({ command, line: bodyIndex + 1 });
    }
  }
  return commands;
}

export function findWorkflowVerificationViolations(
  workflow: string,
  rootDir: string,
  allowlist: readonly string[] = ACTIONS_ONLY_WORKFLOW_COMMAND_ALLOWLIST,
): readonly WorkflowCommandViolation[] {
  const aliases = manifestOwnedAliases(rootDir);
  const argvKeys = manifestArgvKeys();
  const violations: WorkflowCommandViolation[] = [];
  for (const candidate of runCommands(workflow)) {
    for (const segment of splitShellCommands(candidate.command)) {
      const normalized = normalizeInvocation(segment);
      if (!/^(pnpm|node|npx|docker)\b/.test(normalized)) continue;
      if (/^pnpm verify:(?:repo|spine|publish)\b.*(?:^|\s)--profile(?:\s|=)/.test(normalized)) {
        violations.push({
          ...candidate,
          command: segment,
          reason: "verification profile aliases cannot override --profile",
        });
        continue;
      }
      if (allowlist.some((allowed) => matchesArgvPrefix(normalized, allowed))) continue;
      const direct = argvKeys.find((key) => matchesArgvPrefix(normalized, key));
      if (direct) {
        violations.push({
          ...candidate,
          command: segment,
          reason: `direct manifest command: ${direct}`,
        });
        continue;
      }
      const alias = normalized.match(/^pnpm\s+([^\s;]+)/)?.[1];
      if (alias && aliases.has(alias)) {
        violations.push({
          ...candidate,
          command: segment,
          reason: `manifest-owned root alias: ${alias}`,
        });
        continue;
      }
      violations.push({
        ...candidate,
        command: segment,
        reason: "command is not in the Actions-only allowlist",
      });
    }
  }
  return violations;
}

export function findPackageScriptVerificationDuplications(
  scripts: RootScripts,
): readonly WorkflowCommandViolation[] {
  const fingerprints = manifestArgvKeys();
  return Object.entries(scripts)
    .filter(([, command]) => fingerprints.some((fingerprint) => command.includes(fingerprint)))
    .map(([alias, command], index) => ({
      command,
      line: index + 1,
      reason: `root alias ${alias} duplicates a manifest executable array`,
    }));
}

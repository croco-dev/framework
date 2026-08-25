import { createHash } from "node:crypto";
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
const REPOSITORY_CONTRACT_TEST_COMMAND = "pnpm exec vitest run";
export const TRUSTED_GITLEAKS_IMAGE =
  "ghcr.io/gitleaks/gitleaks:v8.23.0@sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e";
const ALLOWED_WRITE_PERMISSIONS = new Set([
  "benchmark-comment.yml:jobs.comment:pull-requests",
  "release.yml:workflow:id-token",
]);

export const ACTIONS_ONLY_WORKFLOW_COMMAND_ALLOWLIST = [
  'node -e \'const fs = require("node:fs"); fs.writeFileSync("ci-reports/package-quality/spine-promotion-run.json", JSON.stringify({ commitSha: process.env.SPINE_PROMOTION_COMMIT_SHA, runId: process.env.SPINE_PROMOTION_RUN_ID, runAttempt: process.env.SPINE_PROMOTION_RUN_ATTEMPT, startedAt: new Date().toISOString() }, null, 2) + "\\n")\'',
  "node --experimental-strip-types scripts/verification-change-classifier.mts",
  "node --experimental-strip-types scripts/release-reconciliation-state.mts",
  "node --experimental-strip-types scripts/changed-test-plan-shadow.mts",
  "node --experimental-strip-types scripts/changed-test-full-suite-status.mts",
  "node --experimental-strip-types scripts/release-spine-evidence.mts",
  "node --experimental-strip-types scripts/ci-performance-budget.mts",
  "node --experimental-strip-types scripts/ci-performance-observer.mts",
  "node --experimental-strip-types scripts/ci-cacheable-experiment-identity.mts",
  "node --experimental-strip-types scripts/ci-cacheable-lane-runner.mts",
  "node --experimental-strip-types scripts/ci-cacheable-security-evidence.mts",
  "node --experimental-strip-types scripts/ci-synthesis-input.mts",
  "node --experimental-strip-types scripts/ci-split-validation-synthesis.mts",
  "node --experimental-strip-types scripts/security-gitleaks-smoke.mts --ensure-sarif ci-reports/security/gitleaks.sarif",
  "node --experimental-strip-types scripts/test-evidence-bundle.mts",
  "node --experimental-strip-types scripts/test-lane-runner.mts",
  "pnpm install --frozen-lockfile",
  "pnpm --dir packages/docs run playwright:install",
  "pnpm audit:prod",
  "pnpm build --filter=@croco/auth-drizzle...",
  "pnpm build --filter=@croco/credits-drizzle...",
  "pnpm build --filter=@croco/entitlements-drizzle...",
  "pnpm build --filter=@croco/execution-drizzle...",
  "pnpm build --filter=@croco/membership-drizzle...",
  "pnpm build --filter=@croco/metering-core...",
  "pnpm build --filter=@croco/metrics-core...",
  "pnpm build --filter=@croco/testing-resources...",
  "pnpm security:gitleaks-smoke",
  "pnpm test",
  "pnpm turbo run test",
  "pnpm --filter @croco/auth-drizzle exec vitest run src/tests/DrizzleApiKeyStore.postgres.spec.ts",
  "pnpm --filter @croco/credits-drizzle test:postgres",
  "pnpm --filter @croco/entitlements-drizzle test:postgres",
  "pnpm --filter @croco/execution-drizzle test:postgres",
  "pnpm --filter @croco/membership-drizzle exec vitest run src/tests/DrizzleMembershipStore.postgres.spec.ts",
  "pnpm --filter @croco/metering-core test:real",
  "pnpm --filter @croco/metrics-core test:real",
  "pnpm --filter @croco/migration-runner exec vitest run src/tests/MigrationStatusPostgres.spec.ts",
  "pnpm --filter @croco/testing-resources test:real",
  "pnpm --filter @croco/testing test",
  "pnpm --filter @croco/testing build",
  "pnpm create-croco-app:smoke -- --tier ecosystem-advisory",
  "pnpm branch-protection:check",
  REPOSITORY_CONTRACT_TEST_COMMAND,
  "pnpm test-inventory:check",
  "pnpm verification-policy:check",
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
  if (allowed === GITLEAKS_PRODUCTION_COMMAND || allowed === REPOSITORY_CONTRACT_TEST_COMMAND) {
    return command === allowed;
  }
  return command === allowed || command.startsWith(`${allowed} `);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown> | null, keys: readonly string[]): boolean {
  return (
    record !== null &&
    JSON.stringify(Object.keys(record).sort()) === JSON.stringify([...keys].sort())
  );
}

function normalizedScript(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
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

function scriptDigest(value: string): string {
  return createHash("sha256").update(normalizedScript(value)).digest("hex");
}

function inspectBenchmarkCommentBoundary(
  path: string,
  workflow: Record<string, unknown>,
): readonly WorkflowPermissionViolation[] {
  if (workflowName(path) !== "benchmark-comment.yml") return [];

  const triggers = isPlainRecord(workflow.on) ? workflow.on : null;
  const workflowRun = isPlainRecord(triggers?.workflow_run) ? triggers.workflow_run : null;
  const topPermissions = isPlainRecord(workflow.permissions) ? workflow.permissions : null;
  const concurrency = isPlainRecord(workflow.concurrency) ? workflow.concurrency : null;
  const jobs = isPlainRecord(workflow.jobs) ? workflow.jobs : null;
  const comment = isPlainRecord(jobs?.comment) ? jobs.comment : null;
  const permissions = isPlainRecord(comment?.permissions) ? comment.permissions : null;
  const steps = Array.isArray(comment?.steps) ? comment.steps : [];
  const checkout = isPlainRecord(steps[0]) ? steps[0] : null;
  const checkoutWith = isPlainRecord(checkout?.with) ? checkout.with : null;
  const metadata = isPlainRecord(steps[1]) ? steps[1] : null;
  const metadataEnvironment = isPlainRecord(metadata?.env) ? metadata.env : null;
  const metadataScript = typeof metadata?.run === "string" ? metadata.run : "";
  const download = isPlainRecord(steps[2]) ? steps[2] : null;
  const downloadWith = isPlainRecord(download?.with) ? download.with : null;
  const artifactValidation = isPlainRecord(steps[3]) ? steps[3] : null;
  const artifactValidationScript =
    typeof artifactValidation?.run === "string" ? artifactValidation.run : "";
  const publish = isPlainRecord(steps[4]) ? steps[4] : null;
  const publishWith = isPlainRecord(publish?.with) ? publish.with : null;
  const publishScript = typeof publishWith?.script === "string" ? publishWith.script : "";

  const valid =
    workflow.name === "Benchmark Comment Publisher" &&
    hasExactKeys(workflow, ["name", "on", "permissions", "concurrency", "jobs"]) &&
    hasExactKeys(triggers, ["workflow_run"]) &&
    workflowRun !== null &&
    hasExactKeys(workflowRun, ["workflows", "types"]) &&
    JSON.stringify(workflowRun.workflows) === JSON.stringify(["Performance Benchmark"]) &&
    JSON.stringify(workflowRun.types) === JSON.stringify(["completed"]) &&
    triggers?.pull_request === undefined &&
    triggers?.pull_request_target === undefined &&
    topPermissions !== null &&
    JSON.stringify(topPermissions) === JSON.stringify({ actions: "read", contents: "read" }) &&
    concurrency !== null &&
    JSON.stringify(concurrency) ===
      JSON.stringify({
        group:
          "benchmark-comment-${{ github.event.workflow_run.pull_requests[0].number || github.event.workflow_run.id }}",
        "cancel-in-progress": true,
      }) &&
    jobs !== null &&
    hasExactKeys(jobs, ["comment"]) &&
    comment !== null &&
    hasExactKeys(comment, ["if", "runs-on", "timeout-minutes", "permissions", "steps"]) &&
    comment.if ===
      "${{ github.event.workflow_run.event == 'pull_request' && github.event.workflow_run.pull_requests[0].number }}" &&
    comment["runs-on"] === "ubuntu-latest" &&
    comment["timeout-minutes"] === 5 &&
    permissions !== null &&
    JSON.stringify(permissions) ===
      JSON.stringify({ actions: "read", contents: "read", "pull-requests": "write" }) &&
    steps.length === 5 &&
    hasExactKeys(metadata, ["name", "id", "shell", "env", "run"]) &&
    metadata?.name === "Validate source run and current pull request" &&
    metadata.id === "source" &&
    metadata.shell === "bash" &&
    metadataEnvironment !== null &&
    JSON.stringify(metadataEnvironment) ===
      JSON.stringify({
        GH_TOKEN: "${{ github.token }}",
        SOURCE_PULL_NUMBER: "${{ github.event.workflow_run.pull_requests[0].number }}",
        SOURCE_RUN_ATTEMPT: "${{ github.event.workflow_run.run_attempt }}",
        SOURCE_RUN_ID: "${{ github.event.workflow_run.id }}",
      }) &&
    scriptDigest(metadataScript) ===
      "7283eae51b003c11678cbbd1857bf43537961651c21149406d3f44890fd143a5" &&
    hasExactKeys(checkout, ["name", "uses", "with"]) &&
    checkout?.name === "Checkout trusted comment publisher" &&
    checkout?.uses === "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1" &&
    checkoutWith?.ref === "${{ github.workflow_sha }}" &&
    checkoutWith["persist-credentials"] === false &&
    hasExactKeys(checkoutWith, ["ref", "persist-credentials"]) &&
    hasExactKeys(download, ["name", "if", "uses", "with"]) &&
    download?.name === "Download exact benchmark readiness report" &&
    download.if === "steps.source.outputs.should_comment == 'true'" &&
    download?.uses === "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c" &&
    downloadWith?.name ===
      "benchmark-readiness-report-${{ github.event.workflow_run.id }}-${{ github.event.workflow_run.run_attempt }}" &&
    downloadWith.path === "benchmark-comment-input" &&
    downloadWith["github-token"] === "${{ github.token }}" &&
    downloadWith["run-id"] === "${{ github.event.workflow_run.id }}" &&
    hasExactKeys(downloadWith, ["name", "path", "github-token", "run-id"]) &&
    hasExactKeys(artifactValidation, ["name", "if", "shell", "run"]) &&
    artifactValidation?.name === "Validate untrusted benchmark artifact" &&
    artifactValidation.if === "steps.source.outputs.should_comment == 'true'" &&
    artifactValidation.shell === "bash" &&
    scriptDigest(artifactValidationScript) ===
      "0968c52c45439932137ac929bcd5c2c5950673737f7e4ba438c6aca124bddd38" &&
    hasExactKeys(publish, ["name", "if", "uses", "with"]) &&
    publish?.name === "Comment PR with benchmark results" &&
    publish.if === "steps.source.outputs.should_comment == 'true'" &&
    publish?.uses === "actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3" &&
    hasExactKeys(publishWith, ["script"]) &&
    scriptDigest(publishScript) ===
      "f1b4eb20613cd272cc4996826d5077d911697541e6a4516948f933286f97a767";

  return valid
    ? []
    : [
        {
          path,
          reason:
            "jobs.comment write access must use the trusted workflow_run artifact publisher boundary",
        },
      ];
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

    violations.push(...inspectBenchmarkCommentBoundary(path, workflow));

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
  const environment = isPlainRecord(workflow.env) ? workflow.env : null;
  const image = environment?.GITLEAKS_IMAGE;
  const violations: string[] = [];
  if (image !== TRUSTED_GITLEAKS_IMAGE) {
    violations.push("env.GITLEAKS_IMAGE must be the digest-pinned trusted image");
  }

  const declarations = workflowSource
    .split(/\r?\n/)
    .map((line, index, lines) => ({ line: line.trim(), previous: lines[index - 1]?.trim() }))
    .filter(({ line }) => /^GITLEAKS_IMAGE\s*:/.test(line));
  if (declarations.length !== 1 || declarations[0]?.previous !== GITLEAKS_RENOVATE_DIRECTIVE) {
    violations.push(
      "the sole GITLEAKS_IMAGE declaration must be workflow env with its Renovate directive attached",
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

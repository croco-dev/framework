#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const DEFAULT_POLICY_PATH = fileURLToPath(
  new URL("./branch-protection-policy.json", import.meta.url),
);
const DEFAULT_CI_WORKFLOW_PATH = ".github/workflows/ci.yml";
const DEFAULT_AUDIT_WORKFLOW_PATH = ".github/workflows/repository-policy-audit.yml";
const DEFAULT_WORKFLOW_DIRECTORY = ".github/workflows";
const CHECKOUT_ACTION = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1";
const PNPM_SETUP_ACTION = "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271";
const NODE_SETUP_ACTION = "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020";
export const REQUIRED_BRANCH_PROTECTION_CHECKS = [
  { context: "benchmark-gate", integrationId: 15368 },
  { context: "docs-sync-check", integrationId: 15368 },
  { context: "repository-contracts", integrationId: 15368 },
  { context: "validate", integrationId: 15368 },
] as const;
const REQUIRED_ACTIONS_CHECK_CONTEXTS = [
  "docs-sync-check",
  "repository-contracts",
  "validate",
] as const;
const REQUIRED_CONTEXT_WORKFLOWS = {
  "benchmark-gate": "benchmark.yml",
  "docs-sync-check": "ci.yml",
  "repository-contracts": "ci.yml",
  validate: "ci.yml",
} as const;
const REQUIRED_REPOSITORY_CONTRACT_TESTS = [
  "scripts/tests/test-inventory.spec.ts",
  "scripts/tests/verification-policy.spec.ts",
  "scripts/tests/branch-protection-policy.spec.ts",
  "scripts/tests/ci-workflow.spec.ts",
  "scripts/tests/benchmark-workflow.spec.ts",
  "scripts/tests/repository-policy-audit-workflow.spec.ts",
] as const;
const REQUIRED_REPOSITORY_CONTRACT_TEST_COMMAND = [
  "pnpm exec vitest run",
  ...REQUIRED_REPOSITORY_CONTRACT_TESTS,
].join(" ");
const CI_WORKFLOW_ENVIRONMENT = {
  GITLEAKS_IMAGE:
    "ghcr.io/gitleaks/gitleaks:v8.23.0@sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e",
  CROCO_CACHEABLE_FAILURE_CLASS: "${{ inputs.cacheable_failure_class || 'none' }}",
} as const;
const CI_WORKFLOW_CONCURRENCY = {
  group: "ci-${{ github.event_name == 'workflow_dispatch' && github.run_id || github.ref }}",
  "cancel-in-progress": true,
} as const;
const AUDIT_WORKFLOW_CONCURRENCY = {
  group: "repository-policy-audit",
  "cancel-in-progress": false,
} as const;
const REPOSITORY_CONTRACT_STEP_NAMES = [
  "Checkout",
  "Setup pnpm",
  "Setup Node.js",
  "Install dependencies",
  "Check authoritative test inventory",
  "Check verification policy",
  "Run repository contract tests",
] as const;
const EXPECTED_VALIDATE_RUN = [
  'args=(--profile "$VERIFICATION_PROFILE" --allow-pending-release-metadata)',
  'if [ "$VERIFICATION_PROFILE" = "spine" ]; then',
  "args+=(--output-dir ci-reports/release)",
  "else",
  'args+=(--output-dir "ci-reports/verification/${VERIFICATION_PROFILE}")',
  "fi",
  'args+=(--base "$VERIFICATION_BASE" --head HEAD)',
  'if [ "$CROCO_CACHEABLE_FAILURE_CLASS" != "none" ]; then',
  "args+=(--full-selection)",
  'args+=(--inject-failure "$CROCO_CACHEABLE_FAILURE_CLASS")',
  "fi",
  'node --experimental-strip-types scripts/release-spine-evidence.mts "${args[@]}"',
].join(" ");
const POLICY_AUDIT_STEP_NAMES = [
  "Checkout",
  "Setup pnpm",
  "Setup Node.js",
  "Install dependencies",
  "Audit effective trunk protection",
] as const;

type JsonRecord = Readonly<Record<string, unknown>>;

export type BranchProtectionPolicySnapshot = {
  readonly branch: string;
  readonly classicProtection: unknown | null;
  readonly defaultBranch: unknown;
  readonly effectiveRules: readonly unknown[];
  readonly rulesets: readonly unknown[];
};

export type RequiredStatusCheck = {
  readonly context: string;
  readonly integrationId: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordValue(record: JsonRecord | undefined, name: string): JsonRecord | undefined {
  const value = record?.[name];
  return isRecord(value) ? value : undefined;
}

function arrayValue(record: JsonRecord | undefined, name: string): readonly unknown[] {
  const value = record?.[name];
  return Array.isArray(value) ? value : [];
}

function sortedStrings(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    return undefined;
  }
  return [...value].sort();
}

function sameStrings(left: unknown, right: unknown): boolean {
  return JSON.stringify(sortedStrings(left)) === JSON.stringify(sortedStrings(right));
}

function ruleByType(ruleset: JsonRecord, type: string): JsonRecord | undefined {
  return arrayValue(ruleset, "rules").find(
    (rule): rule is JsonRecord => isRecord(rule) && rule.type === type,
  );
}

function statusChecks(rule: JsonRecord | undefined): readonly RequiredStatusCheck[] {
  const parameters = recordValue(rule, "parameters");
  return arrayValue(parameters, "required_status_checks").flatMap((check) => {
    if (!isRecord(check)) return [];
    const context = check.context;
    const integrationId = check.integration_id;
    if (typeof context !== "string" || typeof integrationId !== "number") return [];
    return [{ context, integrationId }];
  });
}

function classicStatusChecks(protection: JsonRecord): readonly RequiredStatusCheck[] {
  const required = recordValue(protection, "required_status_checks");
  return arrayValue(required, "checks").flatMap((check) => {
    if (!isRecord(check)) return [];
    const context = check.context;
    const integrationId = check.app_id;
    if (typeof context !== "string" || typeof integrationId !== "number") return [];
    return [{ context, integrationId }];
  });
}

function policyDiagnostic(code: string, message: string): string {
  return `${code}: ${message}`;
}

function hasExactKeys(record: JsonRecord | undefined, keys: readonly string[]): boolean {
  return (
    record !== undefined &&
    JSON.stringify(Object.keys(record).sort()) === JSON.stringify([...keys].sort())
  );
}

function hasExactRecord(record: JsonRecord | undefined, expected: JsonRecord): boolean {
  return (
    hasExactKeys(record, Object.keys(expected)) &&
    Object.entries(expected).every(([key, value]) => record?.[key] === value)
  );
}

export function readExpectedBranchProtectionPolicy(path = DEFAULT_POLICY_PATH): JsonRecord {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(parsed)) throw new TypeError(`${path} must contain a JSON object`);
  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    throw new TypeError(`${path} must declare a non-empty ruleset name`);
  }
  if (parsed.target !== "branch" || parsed.enforcement !== "active") {
    throw new TypeError(`${path} must declare an active branch ruleset`);
  }
  if (!Array.isArray(parsed.bypass_actors) || !Array.isArray(parsed.rules)) {
    throw new TypeError(`${path} must declare bypass_actors and rules arrays`);
  }
  if (parsed.bypass_actors.length > 0) {
    throw new TypeError(`${path} must not declare standing bypass actors`);
  }
  const refName = recordValue(recordValue(parsed, "conditions"), "ref_name");
  if (!sameStrings(refName?.include, ["~DEFAULT_BRANCH"]) || !sameStrings(refName?.exclude, [])) {
    throw new TypeError(`${path} must target only the repository default branch`);
  }
  const requiredRuleTypes = [
    "deletion",
    "non_fast_forward",
    "pull_request",
    "required_status_checks",
  ];
  const ruleTypes = parsed.rules
    .flatMap((rule) => (isRecord(rule) && typeof rule.type === "string" ? [rule.type] : []))
    .sort();
  if (JSON.stringify(ruleTypes) !== JSON.stringify(requiredRuleTypes)) {
    throw new TypeError(`${path} must declare the complete trunk protection rule set`);
  }
  const pullRequest = recordValue(ruleByType(parsed, "pull_request"), "parameters");
  if (
    pullRequest?.required_review_thread_resolution !== true ||
    pullRequest.required_approving_review_count !== 0
  ) {
    throw new TypeError(`${path} must require pull requests and resolved review threads`);
  }
  const requiredStatusChecks = recordValue(
    ruleByType(parsed, "required_status_checks"),
    "parameters",
  );
  if (
    requiredStatusChecks?.strict_required_status_checks_policy !== true ||
    requiredStatusChecks.do_not_enforce_on_create !== false
  ) {
    throw new TypeError(`${path} must enforce strict required checks without a creation bypass`);
  }
  const configuredChecks = statusChecks(ruleByType(parsed, "required_status_checks"));
  if (
    JSON.stringify([...configuredChecks].sort(compareStatusChecks)) !==
    JSON.stringify([...REQUIRED_BRANCH_PROTECTION_CHECKS].sort(compareStatusChecks))
  ) {
    throw new TypeError(`${path} must declare the complete app-bound required check set`);
  }
  return parsed;
}

function compareStatusChecks(left: RequiredStatusCheck, right: RequiredStatusCheck): number {
  return left.context.localeCompare(right.context) || left.integrationId - right.integrationId;
}

export function requiredBranchProtectionChecks(
  expectedPolicy: JsonRecord = readExpectedBranchProtectionPolicy(),
): readonly RequiredStatusCheck[] {
  return statusChecks(ruleByType(expectedPolicy, "required_status_checks"));
}

function inspectClassicProtection(
  protection: unknown | null,
  requiredChecks: readonly RequiredStatusCheck[],
): readonly string[] {
  if (protection === null) return [];
  if (!isRecord(protection)) {
    return [
      policyDiagnostic(
        "BRANCH_POLICY_CLASSIC_UNREADABLE",
        "classic trunk protection is not an inspectable object",
      ),
    ];
  }

  const violations = [
    policyDiagnostic(
      "BRANCH_POLICY_CLASSIC_OVERLAP",
      "classic trunk protection overlaps the authoritative repository ruleset",
    ),
  ];
  if (recordValue(protection, "enforce_admins")?.enabled !== true) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_ADMIN_ENFORCEMENT_DISABLED",
        "classic trunk protection does not apply to repository administrators",
      ),
    );
  }

  const required = recordValue(protection, "required_status_checks");
  if (required?.strict !== true) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_STRICTNESS_DISABLED",
        "classic trunk protection does not require the current base revision",
      ),
    );
  }
  const configuredChecks = classicStatusChecks(protection);
  for (const requiredCheck of requiredChecks) {
    if (
      !configuredChecks.some(
        (check) =>
          check.context === requiredCheck.context &&
          check.integrationId === requiredCheck.integrationId,
      )
    ) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_REQUIRED_CHECK_DRIFT",
          `classic trunk protection must bind ${requiredCheck.context} to GitHub App ${requiredCheck.integrationId}`,
        ),
      );
    }
  }

  const reviews = recordValue(protection, "required_pull_request_reviews");
  const bypass = recordValue(reviews, "bypass_pull_request_allowances");
  for (const actorType of ["users", "teams", "apps"] as const) {
    for (const actor of arrayValue(bypass, actorType)) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_UNAPPROVED_BYPASS",
          `classic trunk protection grants ${actorType} bypass to ${actorLabel(actor)}`,
        ),
      );
    }
  }
  return violations;
}

function actorLabel(actor: unknown): string {
  if (!isRecord(actor)) return JSON.stringify(actor) ?? String(actor);
  for (const key of ["login", "slug", "name", "actor_id"] as const) {
    const value = actor[key];
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return JSON.stringify(actor) ?? String(actor);
}

function inspectRuleset(
  ruleset: JsonRecord,
  expectedPolicy: JsonRecord,
  requiredChecks: readonly RequiredStatusCheck[],
): readonly string[] {
  const violations: string[] = [];
  if (
    ruleset.target !== expectedPolicy.target ||
    ruleset.enforcement !== expectedPolicy.enforcement
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_MODE_DRIFT",
        "the authoritative ruleset must be an active branch ruleset",
      ),
    );
  }
  if (ruleset.source_type !== "Repository") {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_SOURCE_DRIFT",
        "the authoritative ruleset must be owned by this repository",
      ),
    );
  }
  if (!Object.hasOwn(ruleset, "bypass_actors") || !Array.isArray(ruleset.bypass_actors)) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_BYPASS_UNOBSERVABLE",
        "the authoritative ruleset response must expose bypass_actors before no-bypass enforcement can be certified",
      ),
    );
  } else if (ruleset.bypass_actors.length > 0) {
    for (const actor of arrayValue(ruleset, "bypass_actors")) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_UNAPPROVED_BYPASS",
          `the authoritative ruleset grants bypass to ${actorLabel(actor)}`,
        ),
      );
    }
  }

  const expectedRefName = recordValue(recordValue(expectedPolicy, "conditions"), "ref_name");
  const actualRefName = recordValue(recordValue(ruleset, "conditions"), "ref_name");
  if (
    !sameStrings(actualRefName?.include, expectedRefName?.include) ||
    !sameStrings(actualRefName?.exclude, expectedRefName?.exclude)
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_TARGET_DRIFT",
        "the authoritative ruleset must target only the repository default branch",
      ),
    );
  }

  const expectedRuleTypes = arrayValue(expectedPolicy, "rules")
    .flatMap((rule) => (isRecord(rule) && typeof rule.type === "string" ? [rule.type] : []))
    .sort();
  const actualRuleTypes = arrayValue(ruleset, "rules")
    .flatMap((rule) => (isRecord(rule) && typeof rule.type === "string" ? [rule.type] : []))
    .sort();
  if (JSON.stringify(actualRuleTypes) !== JSON.stringify(expectedRuleTypes)) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_RULE_DRIFT",
        `expected rules ${expectedRuleTypes.join(", ")}; received ${actualRuleTypes.join(", ")}`,
      ),
    );
  }

  const expectedPullRequest = recordValue(ruleByType(expectedPolicy, "pull_request"), "parameters");
  const actualPullRequest = recordValue(ruleByType(ruleset, "pull_request"), "parameters");
  for (const [name, expectedValue] of Object.entries(expectedPullRequest ?? {})) {
    if (actualPullRequest?.[name] !== expectedValue) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_PULL_REQUEST_DRIFT",
          `pull_request.${name} must equal ${JSON.stringify(expectedValue)}`,
        ),
      );
    }
  }

  const statusRule = ruleByType(ruleset, "required_status_checks");
  const statusParameters = recordValue(statusRule, "parameters");
  if (statusParameters?.strict_required_status_checks_policy !== true) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_STRICTNESS_DISABLED",
        "the authoritative ruleset does not require checks against the current base revision",
      ),
    );
  }
  if (statusParameters?.do_not_enforce_on_create !== false) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_CREATION_BYPASS",
        "required checks must apply when the protected branch is created",
      ),
    );
  }

  const configuredChecks = [...statusChecks(statusRule)].sort(compareStatusChecks);
  const expectedChecks = [...requiredChecks].sort(compareStatusChecks);
  if (JSON.stringify(configuredChecks) !== JSON.stringify(expectedChecks)) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_REQUIRED_CHECK_SET_DRIFT",
        `expected app-bound checks ${JSON.stringify(expectedChecks)}; received ${JSON.stringify(configuredChecks)}`,
      ),
    );
  }
  return violations;
}

function inspectEffectiveRules(
  rules: readonly unknown[],
  authoritativeRuleset: JsonRecord | undefined,
  expectedPolicy: JsonRecord,
): readonly string[] {
  const violations: string[] = [];
  const authoritativeId = authoritativeRuleset?.id;
  if (typeof authoritativeId !== "number") {
    return [
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_ID_MISSING",
        "the authoritative ruleset detail must expose its numeric id",
      ),
    ];
  }
  const inspectable = rules.filter(isRecord);
  if (inspectable.length !== rules.length) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_EFFECTIVE_RULES_UNREADABLE",
        "the effective rules response contains an uninspectable rule",
      ),
    );
  }
  const expectedTypes = arrayValue(expectedPolicy, "rules")
    .flatMap((rule) => (isRecord(rule) && typeof rule.type === "string" ? [rule.type] : []))
    .sort();
  const authoritativeTypes = inspectable
    .filter((rule) => rule.ruleset_id === authoritativeId)
    .flatMap((rule) => (typeof rule.type === "string" ? [rule.type] : []))
    .sort();
  if (JSON.stringify(authoritativeTypes) !== JSON.stringify(expectedTypes)) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_EFFECTIVE_RULE_DRIFT",
        `trunk must receive ${expectedTypes.join(", ")} from ruleset ${authoritativeId}; received ${authoritativeTypes.join(", ")}`,
      ),
    );
  }
  const overlaps = new Map<number, string>();
  for (const rule of inspectable) {
    const rulesetId = rule.ruleset_id;
    if (typeof rulesetId === "number" && rulesetId !== authoritativeId) {
      overlaps.set(rulesetId, String(rule.ruleset_source ?? rulesetId));
    }
  }
  for (const [rulesetId, source] of overlaps) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_OVERLAP",
        `effective ruleset ${rulesetId} (${source}) also governs trunk`,
      ),
    );
  }
  return violations;
}

export function findBranchProtectionPolicyViolations(
  snapshot: BranchProtectionPolicySnapshot,
  expectedPolicy: JsonRecord = readExpectedBranchProtectionPolicy(),
): readonly string[] {
  const requiredChecks = requiredBranchProtectionChecks(expectedPolicy);
  const violations = [...inspectClassicProtection(snapshot.classicProtection, requiredChecks)];
  const inspectableRulesets = snapshot.rulesets.filter(isRecord);
  const expectedName = expectedPolicy.name;
  const matching = inspectableRulesets.filter(({ name }) => name === expectedName);

  if (snapshot.defaultBranch !== snapshot.branch) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_DEFAULT_BRANCH_DRIFT",
        `repository default branch must remain ${snapshot.branch}; received ${String(snapshot.defaultBranch)}`,
      ),
    );
  }

  if (matching.length !== 1) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_RULESET_CARDINALITY",
        `expected exactly one ${String(expectedName)} ruleset; found ${matching.length}`,
      ),
    );
  } else {
    violations.push(...inspectRuleset(matching[0] ?? {}, expectedPolicy, requiredChecks));
  }
  violations.push(...inspectEffectiveRules(snapshot.effectiveRules, matching[0], expectedPolicy));
  return violations;
}

function jobSteps(job: JsonRecord | undefined): readonly JsonRecord[] {
  return arrayValue(job, "steps").filter(isRecord);
}

function normalizedRun(step: JsonRecord): string | undefined {
  return typeof step.run === "string" ? step.run.replace(/\s+/g, " ").trim() : undefined;
}

function namedStep(job: JsonRecord | undefined, name: string): JsonRecord | undefined {
  return jobSteps(job).find((step) => step.name === name);
}

function inspectPolicyAuditJob(job: JsonRecord | undefined, owner: string): readonly string[] {
  const violations: string[] = [];
  const steps = jobSteps(job);
  if (
    JSON.stringify(steps.map((step) => step.name)) !== JSON.stringify(POLICY_AUDIT_STEP_NAMES) ||
    job?.defaults !== undefined ||
    job?.container !== undefined ||
    job?.strategy !== undefined ||
    job?.env !== undefined ||
    job?.permissions !== undefined ||
    job?.concurrency !== undefined ||
    job?.["runs-on"] !== "ubuntu-latest"
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_JOB_SHAPE_DRIFT",
        `${owner} must contain only the pinned checkout, setup, install, and audit steps`,
      ),
    );
  }
  const checkout = namedStep(job, "Checkout");
  if (
    !hasExactKeys(checkout, ["name", "uses", "with"]) ||
    checkout?.uses !== CHECKOUT_ACTION ||
    !hasExactRecord(recordValue(checkout, "with"), { "persist-credentials": false })
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_BOOTSTRAP_DRIFT",
        `${owner} must use the pinned credential-free checkout`,
      ),
    );
  }
  const pnpm = namedStep(job, "Setup pnpm");
  if (!hasExactKeys(pnpm, ["name", "uses"]) || pnpm?.uses !== PNPM_SETUP_ACTION) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_BOOTSTRAP_DRIFT",
        `${owner} must use the pinned pnpm setup action`,
      ),
    );
  }
  const node = namedStep(job, "Setup Node.js");
  if (
    !hasExactKeys(node, ["name", "uses", "with"]) ||
    node?.uses !== NODE_SETUP_ACTION ||
    !hasExactRecord(recordValue(node, "with"), {
      "node-version-file": ".nvmrc",
      cache: "pnpm",
    })
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_BOOTSTRAP_DRIFT",
        `${owner} must use the pinned Node.js setup`,
      ),
    );
  }
  const install = namedStep(job, "Install dependencies");
  if (
    !hasExactKeys(install, ["name", "run"]) ||
    normalizedRun(install ?? {}) !== "pnpm install --frozen-lockfile --ignore-scripts"
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_BOOTSTRAP_DRIFT",
        `${owner} must install the reviewed lockfile without shell overrides`,
      ),
    );
  }
  const audit = namedStep(job, "Audit effective trunk protection");
  if (
    !hasExactKeys(audit, ["name", "run", "env"]) ||
    normalizedRun(audit ?? {}) !== "pnpm branch-protection:check" ||
    !hasExactRecord(recordValue(audit, "env"), {
      GH_TOKEN: "${{ github.token }}",
    })
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_COMMAND_SKIPPABLE",
        `${owner} must run the read-only branch protection audit unconditionally and block on visible drift`,
      ),
    );
  }
  return violations;
}

function hasRequiredChangeClassificationGuard(
  job: JsonRecord | undefined,
  id: "validate" | "docs-sync-check",
): boolean {
  const first = jobSteps(job)[0];
  const environment = recordValue(first, "env");
  const expectedRun = [
    'if [ "$CHANGE_CLASSIFICATION_RESULT" != "success" ]; then',
    `echo "::error::Change classification concluded $CHANGE_CLASSIFICATION_RESULT; ${id} cannot authorize this revision."`,
    "exit 1",
    "fi",
    ...(id === "docs-sync-check"
      ? [
          'if [ "$API_SOURCE_RESULT" != "true" ] && [ "$API_SOURCE_RESULT" != "false" ]; then',
          'echo "::error::API source classification is missing or invalid; docs-sync-check cannot authorize this revision."',
          "exit 1",
          "fi",
        ]
      : []),
  ].join(" ");
  return (
    hasExactKeys(first, ["name", "shell", "env", "run"]) &&
    first?.name === "Require successful change classification" &&
    first.shell === "bash" &&
    hasExactRecord(
      environment,
      id === "docs-sync-check"
        ? {
            CHANGE_CLASSIFICATION_RESULT: "${{ needs.changes.result }}",
            API_SOURCE_RESULT: "${{ needs.changes.outputs.api-source }}",
          }
        : { CHANGE_CLASSIFICATION_RESULT: "${{ needs.changes.result }}" },
    ) &&
    normalizedRun(first ?? {}) === expectedRun
  );
}

function hasRequiredJobExecutionOverride(job: JsonRecord | undefined): boolean {
  const allowedEnvironmentWrites = new Map([
    [
      "Start validate performance measurement",
      'echo "CROCO_VALIDATE_MEASUREMENT_STARTED_AT=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" >> "$GITHUB_ENV"',
    ],
    [
      "Complete validate performance measurement",
      'echo "CROCO_VALIDATE_MEASUREMENT_COMPLETED_AT=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)" >> "$GITHUB_ENV"',
    ],
  ]);
  return jobSteps(job).some((step) => {
    const environment = recordValue(step, "env");
    if (environment && ["BASH_ENV", "ENV", "NODE_OPTIONS"].some((name) => name in environment)) {
      return true;
    }
    const run = normalizedRun(step);
    if (!run) return false;
    if (run.includes("$GITHUB_PATH")) return true;
    if (!run.includes("$GITHUB_ENV")) return false;
    return allowedEnvironmentWrites.get(String(step.name)) !== run;
  });
}

function inspectRequiredJob(
  jobs: JsonRecord,
  id: string,
  expectedNeeds: unknown,
  expectedCondition: unknown,
  expectedJobEnvironment?: JsonRecord,
  expectedDeploymentEnvironment?: string,
): readonly string[] {
  const job = recordValue(jobs, id);
  if (!job) {
    return [
      policyDiagnostic("BRANCH_POLICY_WORKFLOW_JOB_MISSING", `ci.yml must declare job ${id}`),
    ];
  }
  const violations: string[] = [];
  if (JSON.stringify(job.needs) !== JSON.stringify(expectedNeeds)) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_DEPENDENCY_DRIFT",
        `${id}.needs must equal ${JSON.stringify(expectedNeeds)}`,
      ),
    );
  }
  if (job.if !== expectedCondition) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_CONDITION_DRIFT",
        `${id}.if must equal ${JSON.stringify(expectedCondition)}`,
      ),
    );
  }
  if (job["continue-on-error"] !== undefined) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_NONBLOCKING",
        `${id} must not use continue-on-error`,
      ),
    );
  }
  if (
    (job.name !== undefined && job.name !== id) ||
    job.strategy !== undefined ||
    job.defaults !== undefined ||
    job.container !== undefined ||
    job.uses !== undefined ||
    job.permissions !== undefined ||
    job.concurrency !== undefined ||
    job.environment !== expectedDeploymentEnvironment ||
    job["runs-on"] !== "ubuntu-latest" ||
    (expectedJobEnvironment === undefined
      ? job.env !== undefined
      : !hasExactRecord(recordValue(job, "env"), expectedJobEnvironment))
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_CHECK_IDENTITY_DRIFT",
        `${id} must emit the literal ${id} check on the pinned runner without inherited execution overrides`,
      ),
    );
  }
  return violations;
}

function inspectRepositoryContractJob(job: JsonRecord | undefined): readonly string[] {
  const violations: string[] = [];
  const steps = jobSteps(job);
  if (
    !hasExactKeys(job, ["runs-on", "timeout-minutes", "steps"]) ||
    job?.["runs-on"] !== "ubuntu-latest" ||
    job?.["timeout-minutes"] !== 15 ||
    JSON.stringify(steps.map((step) => step.name)) !==
      JSON.stringify(REPOSITORY_CONTRACT_STEP_NAMES)
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_CONTRACT_JOB_SHAPE_DRIFT",
        "repository-contracts must contain only the pinned bootstrap and repository contract steps",
      ),
    );
  }
  const checkout = namedStep(job, "Checkout");
  const pnpm = namedStep(job, "Setup pnpm");
  const node = namedStep(job, "Setup Node.js");
  const install = namedStep(job, "Install dependencies");
  if (
    !hasExactKeys(checkout, ["name", "uses", "with"]) ||
    checkout?.uses !== CHECKOUT_ACTION ||
    !hasExactRecord(recordValue(checkout, "with"), { "persist-credentials": false }) ||
    !hasExactKeys(pnpm, ["name", "uses"]) ||
    pnpm?.uses !== PNPM_SETUP_ACTION ||
    !hasExactKeys(node, ["name", "uses", "with"]) ||
    node?.uses !== NODE_SETUP_ACTION ||
    !hasExactRecord(recordValue(node, "with"), {
      "node-version-file": ".nvmrc",
      cache: "pnpm",
    }) ||
    !hasExactKeys(install, ["name", "run"]) ||
    normalizedRun(install ?? {}) !== "pnpm install --frozen-lockfile --ignore-scripts"
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_CONTRACT_BOOTSTRAP_DRIFT",
        "repository-contracts must use pinned bootstrap actions and a lifecycle-free lockfile install",
      ),
    );
  }
  const inventory = namedStep(job, "Check authoritative test inventory");
  const verification = namedStep(job, "Check verification policy");
  const tests = namedStep(job, "Run repository contract tests");
  if (
    !hasExactKeys(inventory, ["name", "run"]) ||
    normalizedRun(inventory ?? {}) !== "pnpm test-inventory:check" ||
    !hasExactKeys(verification, ["name", "run"]) ||
    normalizedRun(verification ?? {}) !== "pnpm verification-policy:check" ||
    !hasExactKeys(tests, ["name", "run"]) ||
    normalizedRun(tests ?? {}) !== REQUIRED_REPOSITORY_CONTRACT_TEST_COMMAND
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_CONTRACT_COMMAND_DRIFT",
        "repository-contracts must execute only the reviewed invariant commands in order",
      ),
    );
  }
  return violations;
}

export function findRequiredWorkflowPolicyViolations(source: string): readonly string[] {
  let workflow: unknown;
  try {
    workflow = parseYaml(source);
  } catch {
    return [policyDiagnostic("BRANCH_POLICY_WORKFLOW_UNREADABLE", "ci.yml is not valid YAML")];
  }
  if (!isRecord(workflow)) {
    return [policyDiagnostic("BRANCH_POLICY_WORKFLOW_UNREADABLE", "ci.yml must be a YAML object")];
  }

  const violations: string[] = [];
  if (
    !hasExactKeys(workflow, ["name", "on", "permissions", "env", "concurrency", "jobs"]) ||
    workflow.name !== "CI" ||
    workflow.defaults !== undefined ||
    !hasExactRecord(recordValue(workflow, "permissions"), { contents: "read" }) ||
    !hasExactRecord(recordValue(workflow, "env"), CI_WORKFLOW_ENVIRONMENT) ||
    !hasExactRecord(recordValue(workflow, "concurrency"), CI_WORKFLOW_CONCURRENCY)
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_SHELL_DEFAULT_DRIFT",
        "ci.yml must retain its exact top-level permissions, environment, concurrency, and shell policy",
      ),
    );
  }
  const triggers = recordValue(workflow, "on");
  const pullRequest = recordValue(triggers, "pull_request");
  if (!pullRequest || !arrayValue(pullRequest, "branches").includes("trunk")) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_PR_TRIGGER_MISSING",
        "ci.yml must run for pull requests targeting trunk",
      ),
    );
  }
  if (
    pullRequest?.paths !== undefined ||
    pullRequest?.["paths-ignore"] !== undefined ||
    pullRequest?.types !== undefined
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_PATH_FILTER",
        "ci.yml pull_request must not use paths, paths-ignore, or restricted event types",
      ),
    );
  }

  const jobs = recordValue(workflow, "jobs");
  if (!jobs) {
    violations.push(
      policyDiagnostic("BRANCH_POLICY_WORKFLOW_JOBS_MISSING", "ci.yml must declare jobs"),
    );
    return violations;
  }

  const changes = recordValue(jobs, "changes");
  const changeOutputs = recordValue(changes, "outputs");
  const filterStep = jobSteps(changes).find((step) => step.id === "filter");
  const filterSource = recordValue(filterStep, "with")?.filters;
  let filters: unknown;
  try {
    filters = typeof filterSource === "string" ? parseYaml(filterSource) : undefined;
  } catch {
    filters = undefined;
  }
  if (
    changeOutputs?.["api-source"] !== "${{ steps.filter.outputs.api-source }}" ||
    !isRecord(filters) ||
    !Array.isArray(filters["api-source"]) ||
    filters["api-source"].length === 0
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_WORKFLOW_CHANGE_OUTPUT_DRIFT",
        "changes must expose the non-empty api-source filter through steps.filter.outputs.api-source",
      ),
    );
  }

  for (const context of REQUIRED_ACTIONS_CHECK_CONTEXTS) {
    if (!recordValue(jobs, context)) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_WORKFLOW_JOB_MISSING",
          `ci.yml must declare required status job ${context}`,
        ),
      );
    }
  }

  violations.push(...inspectRequiredJob(jobs, "repository-contracts", undefined, undefined));
  const repositoryContracts = recordValue(jobs, "repository-contracts");
  if (repositoryContracts) {
    violations.push(...inspectRepositoryContractJob(repositoryContracts));
  }

  for (const id of ["validate", "docs-sync-check"] as const) {
    violations.push(
      ...inspectRequiredJob(
        jobs,
        id,
        "changes",
        "${{ always() }}",
        id === "validate" ? { NPM_CONFIG_PROVENANCE: "true" } : undefined,
      ),
    );
    if (!hasRequiredChangeClassificationGuard(recordValue(jobs, id), id)) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_WORKFLOW_PREREQUISITE_GUARD_MISSING",
          `${id} must fail when change classification is not successful`,
        ),
      );
    }
    if (hasRequiredJobExecutionOverride(recordValue(jobs, id))) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_WORKFLOW_EXECUTION_OVERRIDE",
          `${id} must not preload processes or rewrite the runner execution environment`,
        ),
      );
    }
  }
  const validateStep = namedStep(
    recordValue(jobs, "validate"),
    "Run selected verification profile",
  );
  const validateRun = validateStep ? normalizedRun(validateStep) : undefined;
  if (
    !hasExactKeys(validateStep, ["name", "id", "shell", "env", "run"]) ||
    validateStep?.id !== "verification_profile" ||
    validateStep?.shell !== "bash" ||
    !hasExactRecord(recordValue(validateStep, "env"), {
      CROCO_TEST_EVIDENCE_DIR: "${{ github.workspace }}/ci-reports/test-evidence/records",
      VERIFICATION_BASE: "${{ needs.changes.outputs.base }}",
      VERIFICATION_PROFILE: "${{ needs.changes.outputs.profile }}",
    }) ||
    validateRun !== EXPECTED_VALIDATE_RUN
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_VALIDATE_COMMAND_SKIPPABLE",
        "validate must execute the selected verification profile unconditionally and block on failure",
      ),
    );
  }
  const docsStep = namedStep(
    recordValue(jobs, "docs-sync-check"),
    "Build docs and check for drift",
  );
  const docsRun = docsStep ? normalizedRun(docsStep) : undefined;
  if (
    !hasExactKeys(docsStep, ["name", "if", "run"]) ||
    docsStep?.if !== "needs.changes.outputs.api-source == 'true'" ||
    docsRun !== "pnpm docs:api:check"
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_DOCS_COMMAND_SKIPPABLE",
        "docs-sync-check must execute the API documentation drift contract for API-source changes",
      ),
    );
  }
  return [...new Set(violations)];
}

export function findRequiredWorkflowContextCollisionViolations(
  workflows: Readonly<Record<string, string>>,
  authoritativePath = "ci.yml",
): readonly string[] {
  const requiredContexts = new Set(REQUIRED_BRANCH_PROTECTION_CHECKS.map(({ context }) => context));
  const authoritativeWorkflows: Readonly<Record<string, string>> = {
    ...REQUIRED_CONTEXT_WORKFLOWS,
    "docs-sync-check": authoritativePath,
    "repository-contracts": authoritativePath,
    validate: authoritativePath,
  };
  const observedAuthoritativeContexts = new Set<string>();
  const violations: string[] = [];
  for (const [path, source] of Object.entries(workflows)) {
    let workflow: unknown;
    try {
      workflow = parseYaml(source);
    } catch {
      violations.push(
        policyDiagnostic("BRANCH_POLICY_WORKFLOW_UNREADABLE", `${path} is not valid YAML`),
      );
      continue;
    }
    const jobs = recordValue(isRecord(workflow) ? workflow : undefined, "jobs");
    if (!jobs) continue;
    for (const [jobId, value] of Object.entries(jobs)) {
      if (!isRecord(value)) continue;
      const displayName = typeof value.name === "string" ? value.name : jobId;
      const authoritative = authoritativeWorkflows[jobId] === path;
      if (authoritative) {
        observedAuthoritativeContexts.add(jobId);
        continue;
      }
      if (
        displayName.includes("${{") ||
        requiredContexts.has(displayName) ||
        requiredContexts.has(jobId)
      ) {
        violations.push(
          policyDiagnostic(
            "BRANCH_POLICY_WORKFLOW_CONTEXT_COLLISION",
            `${path} job ${jobId} can collide with a reserved required-check context`,
          ),
        );
      }
    }
  }
  for (const context of requiredContexts) {
    if (!observedAuthoritativeContexts.has(context)) {
      violations.push(
        policyDiagnostic(
          "BRANCH_POLICY_WORKFLOW_JOB_MISSING",
          `${authoritativeWorkflows[context]} must declare required status job ${context}`,
        ),
      );
    }
  }
  return violations;
}

export function findRepositoryPolicyAuditWorkflowViolations(source: string): readonly string[] {
  let workflow: unknown;
  try {
    workflow = parseYaml(source);
  } catch {
    return [
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_WORKFLOW_UNREADABLE",
        "repository policy audit workflow is not valid YAML",
      ),
    ];
  }
  if (!isRecord(workflow)) {
    return [
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_WORKFLOW_UNREADABLE",
        "repository policy audit workflow must be a YAML object",
      ),
    ];
  }
  const violations: string[] = [];
  if (
    !hasExactKeys(workflow, ["name", "on", "permissions", "concurrency", "jobs"]) ||
    workflow.name !== "Repository Policy Audit" ||
    workflow.defaults !== undefined ||
    workflow.env !== undefined ||
    !hasExactRecord(recordValue(workflow, "permissions"), { contents: "read" }) ||
    !hasExactRecord(recordValue(workflow, "concurrency"), AUDIT_WORKFLOW_CONCURRENCY)
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_WORKFLOW_SHELL_DEFAULT_DRIFT",
        "repository policy audit workflow must retain its exact environment-free permission, concurrency, and shell policy",
      ),
    );
  }
  const triggers = recordValue(workflow, "on");
  if (arrayValue(triggers, "schedule").length === 0) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_SCHEDULE_MISSING",
        "repository policy audit workflow must declare a schedule",
      ),
    );
  }
  if (!triggers || !Object.hasOwn(triggers, "workflow_dispatch")) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_MANUAL_TRIGGER_MISSING",
        "repository policy audit workflow must support workflow_dispatch",
      ),
    );
  }
  const audit = recordValue(recordValue(workflow, "jobs"), "audit");
  if (!audit) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_JOB_MISSING",
        "repository policy audit workflow must declare job audit",
      ),
    );
    return violations;
  }
  if (
    !hasExactKeys(audit, ["runs-on", "timeout-minutes", "steps"]) ||
    audit["runs-on"] !== "ubuntu-latest" ||
    audit["timeout-minutes"] !== 10 ||
    audit.if !== undefined ||
    audit.needs !== undefined ||
    audit["continue-on-error"] !== undefined ||
    audit.env !== undefined ||
    audit.concurrency !== undefined
  ) {
    violations.push(
      policyDiagnostic(
        "BRANCH_POLICY_AUDIT_JOB_SKIPPABLE",
        "repository policy audit job must be unconditional, independent, and blocking",
      ),
    );
  }
  violations.push(...inspectPolicyAuditJob(audit, "repository policy audit workflow"));
  return violations;
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function ghApi(path: string, allowNotFound = false): unknown | null {
  const result = spawnSync("gh", ["api", path], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status === 0) return JSON.parse(result.stdout) as unknown;
  const diagnostic = `${result.stderr}\n${result.stdout}`.trim();
  if (allowNotFound && /\(HTTP 404\)/.test(diagnostic)) return null;
  throw new Error(`gh api ${path} failed: ${diagnostic}`);
}

function ghApiPages(path: string): readonly unknown[] {
  const result = spawnSync("gh", ["api", "--paginate", "--slurp", path], {
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const diagnostic = `${result.stderr}\n${result.stdout}`.trim();
    throw new Error(`gh api --paginate ${path} failed: ${diagnostic}`);
  }
  const pages = JSON.parse(result.stdout) as unknown;
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new TypeError(`GitHub paginated response for ${path} must contain array pages`);
  }
  return pages.flat();
}

function livePolicySnapshot(repository: string, branch: string): BranchProtectionPolicySnapshot {
  const metadata = ghApi(`repos/${repository}`);
  if (!isRecord(metadata)) throw new TypeError("GitHub repository response must be an object");
  const classicProtection = ghApi(`repos/${repository}/branches/${branch}/protection`, true);
  const effectiveRules = ghApiPages(`repos/${repository}/rules/branches/${branch}?per_page=100`);
  const summaries = ghApiPages(`repos/${repository}/rulesets?includes_parents=true&per_page=100`);
  const effectiveIds = new Set(
    effectiveRules.flatMap((rule) =>
      isRecord(rule) && typeof rule.ruleset_id === "number" ? [rule.ruleset_id] : [],
    ),
  );
  const rulesets = summaries
    .filter(
      (summary) =>
        isRecord(summary) &&
        (effectiveIds.has(Number(summary.id)) || summary.name === "trunk-merge-policy"),
    )
    .map((summary) => {
      if (!isRecord(summary) || typeof summary.id !== "number") {
        throw new TypeError("GitHub ruleset summary must declare a numeric id");
      }
      return ghApi(`repos/${repository}/rulesets/${summary.id}?includes_parents=true`);
    });
  return {
    branch,
    classicProtection,
    defaultBranch: metadata.default_branch,
    effectiveRules,
    rulesets,
  };
}

function main(): void {
  const arguments_ = process.argv.slice(2);
  const repository = optionValue(arguments_, "--repo") ?? "croco-dev/framework";
  const branch = optionValue(arguments_, "--branch") ?? "trunk";
  const policyPath = optionValue(arguments_, "--policy") ?? DEFAULT_POLICY_PATH;
  const workflowPath = optionValue(arguments_, "--workflow") ?? DEFAULT_CI_WORKFLOW_PATH;
  const auditWorkflowPath =
    optionValue(arguments_, "--audit-workflow") ?? DEFAULT_AUDIT_WORKFLOW_PATH;
  const workflowDirectory =
    optionValue(arguments_, "--workflow-directory") ?? DEFAULT_WORKFLOW_DIRECTORY;
  const expectedPolicy = readExpectedBranchProtectionPolicy(policyPath);
  const violations = [
    ...findBranchProtectionPolicyViolations(livePolicySnapshot(repository, branch), expectedPolicy),
    ...findRequiredWorkflowPolicyViolations(readFileSync(workflowPath, "utf8")),
    ...findRequiredWorkflowContextCollisionViolations(
      Object.fromEntries(
        readdirSync(workflowDirectory)
          .filter((path) => /\.ya?ml$/.test(path))
          .map((path) => [path, readFileSync(join(workflowDirectory, path), "utf8")]),
      ),
    ),
    ...findRepositoryPolicyAuditWorkflowViolations(readFileSync(auditWorkflowPath, "utf8")),
  ];
  if (violations.length > 0) {
    process.stderr.write(
      `branch-protection-policy: effective policy drift detected.\n${violations.map((violation) => `- ${violation}`).join("\n")}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const contexts = requiredBranchProtectionChecks(expectedPolicy)
    .map(({ context }) => context)
    .join(", ");
  process.stdout.write(
    `branch-protection-policy: ${repository} ${branch} is governed by an active no-bypass ruleset with strict app-bound checks (${contexts}) and audited required workflows.\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findBranchProtectionPolicyViolations,
  readExpectedBranchProtectionPolicy,
  requiredBranchProtectionChecks,
} from "../branch-protection-policy.mts";

type MutableRecord = Record<string, unknown>;

const EXPECTED_POLICY = readExpectedBranchProtectionPolicy();
const RULESET_ID = 21_250_891;

function liveRuleset(): MutableRecord {
  return {
    ...(structuredClone(EXPECTED_POLICY) as MutableRecord),
    id: RULESET_ID,
    source_type: "Repository",
  };
}

function effectiveRules(rulesetId = RULESET_ID): MutableRecord[] {
  const rules = EXPECTED_POLICY.rules;
  if (!Array.isArray(rules)) throw new TypeError("expected policy must declare rules");
  return rules.map((entry) => ({
    ...(structuredClone(entry) as MutableRecord),
    ruleset_id: rulesetId,
    ruleset_source: "croco-dev/framework",
    ruleset_source_type: "Repository",
  }));
}

function liveSnapshot(
  overrides: Partial<Parameters<typeof findBranchProtectionPolicyViolations>[0]> = {},
) {
  return {
    branch: "trunk",
    classicProtection: null,
    defaultBranch: "trunk",
    effectiveRules: effectiveRules(),
    rulesets: [liveRuleset()],
    ...overrides,
  };
}

function rule(ruleset: MutableRecord, type: string): MutableRecord {
  const rules = ruleset.rules;
  if (!Array.isArray(rules)) throw new TypeError("fixture ruleset must declare rules");
  const match = rules.find(
    (candidate): candidate is MutableRecord =>
      typeof candidate === "object" &&
      candidate !== null &&
      !Array.isArray(candidate) &&
      candidate.type === type,
  );
  if (!match) throw new TypeError(`fixture ruleset must declare ${type}`);
  return match;
}

function parameters(ruleset: MutableRecord, type: string): MutableRecord {
  const value = rule(ruleset, type).parameters;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`fixture ${type} rule must declare parameters`);
  }
  return value as MutableRecord;
}

describe("branch-protection-policy.mts", () => {
  it("requires the stable benchmark gate from the GitHub Actions integration", () => {
    expect(requiredBranchProtectionChecks(EXPECTED_POLICY)).toContainEqual({
      context: "benchmark-gate",
      integrationId: 15368,
    });
  });

  it.each([
    [
      "required check",
      (policy: MutableRecord) => {
        const checks = parameters(policy, "required_status_checks").required_status_checks;
        if (!Array.isArray(checks)) throw new TypeError("fixture must declare required checks");
        parameters(policy, "required_status_checks").required_status_checks = checks.filter(
          (check) =>
            typeof check !== "object" ||
            check === null ||
            Array.isArray(check) ||
            !("context" in check) ||
            check.context !== "repository-contracts",
        );
      },
    ],
    [
      "bypass actor",
      (policy: MutableRecord) => {
        policy.bypass_actors = [
          { actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" },
        ];
      },
    ],
    [
      "protection rule",
      (policy: MutableRecord) => {
        const rules = policy.rules;
        if (!Array.isArray(rules)) throw new TypeError("fixture must declare rules");
        policy.rules = rules.filter(
          (candidate) =>
            typeof candidate !== "object" ||
            candidate === null ||
            Array.isArray(candidate) ||
            !("type" in candidate) ||
            candidate.type !== "non_fast_forward",
        );
      },
    ],
    [
      "review-thread enforcement",
      (policy: MutableRecord) => {
        parameters(policy, "pull_request").required_review_thread_resolution = false;
      },
    ],
  ])("rejects a source-of-truth policy that weakens %s", (_name, mutate) => {
    const policy = structuredClone(EXPECTED_POLICY) as MutableRecord;
    mutate(policy);
    const directory = mkdtempSync(join(tmpdir(), "croco-branch-policy-"));
    const path = join(directory, "policy.json");
    writeFileSync(path, JSON.stringify(policy));
    try {
      expect(() => readExpectedBranchProtectionPolicy(path)).toThrow();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("accepts the active repository-owned no-bypass ruleset", () => {
    expect(findBranchProtectionPolicyViolations(liveSnapshot())).toEqual([]);
  });

  it("rejects required checks that remain valid after trunk advances", () => {
    const ruleset = liveRuleset();
    parameters(ruleset, "required_status_checks").strict_required_status_checks_policy = false;

    expect(findBranchProtectionPolicyViolations(liveSnapshot({ rulesets: [ruleset] }))).toContain(
      "BRANCH_POLICY_STRICTNESS_DISABLED: the authoritative ruleset does not require checks against the current base revision",
    );
  });

  it("rejects required contexts that are not bound to GitHub Actions", () => {
    const ruleset = liveRuleset();
    const checks = parameters(ruleset, "required_status_checks").required_status_checks;
    if (!Array.isArray(checks)) throw new TypeError("fixture must declare required checks");
    const docs = checks.find(
      (check): check is MutableRecord =>
        typeof check === "object" &&
        check !== null &&
        !Array.isArray(check) &&
        check.context === "docs-sync-check",
    );
    if (!docs) throw new TypeError("fixture must declare docs-sync-check");
    docs.integration_id = 1;

    expect(
      findBranchProtectionPolicyViolations(liveSnapshot({ rulesets: [ruleset] })),
    ).toContainEqual(expect.stringContaining("BRANCH_POLICY_REQUIRED_CHECK_SET_DRIFT"));
  });

  it("rejects disabled administrator enforcement in overlapping classic protection", () => {
    expect(
      findBranchProtectionPolicyViolations(
        liveSnapshot({
          classicProtection: {
            enforce_admins: { enabled: false },
            required_status_checks: { strict: true, checks: [] },
            required_pull_request_reviews: {
              bypass_pull_request_allowances: { users: [], teams: [], apps: [] },
            },
          },
        }),
      ),
    ).toContain(
      "BRANCH_POLICY_ADMIN_ENFORCEMENT_DISABLED: classic trunk protection does not apply to repository administrators",
    );
  });

  it.each(["users", "teams", "apps"] as const)(
    "rejects an unapproved classic %s bypass",
    (actorType) => {
      expect(
        findBranchProtectionPolicyViolations(
          liveSnapshot({
            classicProtection: {
              enforce_admins: { enabled: true },
              required_status_checks: { strict: true, checks: [] },
              required_pull_request_reviews: {
                bypass_pull_request_allowances: {
                  users: actorType === "users" ? [{ login: "maintainer" }] : [],
                  teams: actorType === "teams" ? [{ slug: "maintainers" }] : [],
                  apps: actorType === "apps" ? [{ name: "merge-app" }] : [],
                },
              },
            },
          }),
        ),
      ).toContainEqual(expect.stringContaining("BRANCH_POLICY_UNAPPROVED_BYPASS"));
    },
  );

  it("rejects a ruleset bypass actor", () => {
    const ruleset = liveRuleset();
    ruleset.bypass_actors = [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }];

    expect(
      findBranchProtectionPolicyViolations(liveSnapshot({ rulesets: [ruleset] })),
    ).toContainEqual(expect.stringContaining("BRANCH_POLICY_UNAPPROVED_BYPASS"));
  });

  it("fails closed when the token cannot expose ruleset bypass actors", () => {
    const ruleset = liveRuleset();
    delete ruleset.bypass_actors;

    expect(
      findBranchProtectionPolicyViolations(liveSnapshot({ rulesets: [ruleset] })),
    ).toContainEqual(expect.stringContaining("BRANCH_POLICY_BYPASS_UNOBSERVABLE"));
  });

  it("rejects overlapping classic protection and active default-branch rulesets", () => {
    const overlapping = liveRuleset();
    overlapping.name = "legacy-trunk-policy";
    overlapping.id = RULESET_ID + 1;

    expect(
      findBranchProtectionPolicyViolations(
        liveSnapshot({
          classicProtection: {
            enforce_admins: { enabled: true },
            required_status_checks: { strict: true, checks: [] },
            required_pull_request_reviews: {
              bypass_pull_request_allowances: { users: [], teams: [], apps: [] },
            },
          },
          effectiveRules: [...effectiveRules(), ...effectiveRules(RULESET_ID + 1)],
          rulesets: [liveRuleset(), overlapping],
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("BRANCH_POLICY_CLASSIC_OVERLAP"),
        expect.stringContaining("BRANCH_POLICY_RULESET_OVERLAP"),
      ]),
    );
  });

  it("rejects inherited or wildcard rulesets that effectively govern trunk", () => {
    expect(
      findBranchProtectionPolicyViolations(
        liveSnapshot({ effectiveRules: [...effectiveRules(), ...effectiveRules(99)] }),
      ),
    ).toContainEqual(expect.stringContaining("BRANCH_POLICY_RULESET_OVERLAP"));
  });

  it("rejects moving the default branch away from trunk", () => {
    expect(
      findBranchProtectionPolicyViolations(liveSnapshot({ defaultBranch: "main" })),
    ).toContainEqual(expect.stringContaining("BRANCH_POLICY_DEFAULT_BRANCH_DRIFT"));
  });

  it("rejects duplicate required status contexts even when one App binding is correct", () => {
    const ruleset = liveRuleset();
    const checks = parameters(ruleset, "required_status_checks").required_status_checks;
    if (!Array.isArray(checks)) throw new TypeError("fixture must declare required checks");
    checks.push({ context: "validate", integration_id: 1 });

    expect(
      findBranchProtectionPolicyViolations(liveSnapshot({ rulesets: [ruleset] })),
    ).toContainEqual(expect.stringContaining("BRANCH_POLICY_REQUIRED_CHECK_SET_DRIFT"));
  });

  it("uses only GitHub GET requests while auditing the live policy", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-branch-policy-gh-"));
    const executable = join(directory, "gh");
    const log = join(directory, "requests.log");
    const ruleset = liveRuleset();
    const script = `#!/usr/bin/env node
const fs = require("node:fs");
const path = process.argv.at(-1);
fs.appendFileSync(process.env.FAKE_GH_LOG, process.argv.slice(2).join(" ") + "\\n");
const responses = ${JSON.stringify({
      "repos/croco-dev/framework": { default_branch: "trunk" },
      "repos/croco-dev/framework/rules/branches/trunk?per_page=100": [effectiveRules()],
      "repos/croco-dev/framework/rulesets?includes_parents=true&per_page=100": [
        [{ id: RULESET_ID, name: "trunk-merge-policy" }],
      ],
      [`repos/croco-dev/framework/rulesets/${RULESET_ID}?includes_parents=true`]: ruleset,
    })};
if (path === "repos/croco-dev/framework/branches/trunk/protection") {
  process.stderr.write("not found (HTTP 404)\\n");
  process.exit(1);
}
if (!(path in responses)) process.exit(2);
process.stdout.write(JSON.stringify(responses[path]));
`;
    writeFileSync(executable, script);
    chmodSync(executable, 0o755);
    try {
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          resolve(import.meta.dirname, "../branch-protection-policy.mts"),
        ],
        {
          cwd: resolve(import.meta.dirname, "../.."),
          encoding: "utf8",
          env: {
            ...process.env,
            FAKE_GH_LOG: log,
            PATH: `${directory}:${process.env.PATH ?? ""}`,
          },
        },
      );
      expect(result.status, result.stderr).toBe(0);
      const requests = readFileSync(log, "utf8").trim().split("\n");
      expect(requests).toEqual([
        "api repos/croco-dev/framework",
        "api repos/croco-dev/framework/branches/trunk/protection",
        "api --paginate --slurp repos/croco-dev/framework/rules/branches/trunk?per_page=100",
        "api --paginate --slurp repos/croco-dev/framework/rulesets?includes_parents=true&per_page=100",
        `api repos/croco-dev/framework/rulesets/${RULESET_ID}?includes_parents=true`,
      ]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

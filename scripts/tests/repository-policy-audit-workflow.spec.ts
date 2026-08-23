import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { findRepositoryPolicyAuditWorkflowViolations } from "../branch-protection-policy.mts";

const WORKFLOW = readFileSync(
  resolve(import.meta.dirname, "../../.github/workflows/repository-policy-audit.yml"),
  "utf8",
);

describe("repository policy audit workflow", () => {
  it("runs the live audit on both schedule and manual dispatch", () => {
    expect(findRepositoryPolicyAuditWorkflowViolations(WORKFLOW)).toEqual([]);
    expect(WORKFLOW).toContain("permissions:\n  contents: read");
    expect(WORKFLOW).toContain("GH_TOKEN: ${{ github.token }}");
    expect(WORKFLOW).not.toContain("environment:");
    expect(WORKFLOW).not.toContain("actions/create-github-app-token");
    expect(WORKFLOW).not.toContain("RELEASE_APP_");
  });

  it.each([
    ["schedule", WORKFLOW.replace('  schedule:\n    - cron: "17 3 * * *"\n', "")],
    ["manual trigger", WORKFLOW.replace("  workflow_dispatch:\n", "")],
    ["audit job", WORKFLOW.replace("  audit:\n", "  audit-renamed:\n")],
    [
      "blocking command",
      WORKFLOW.replace("run: pnpm branch-protection:check", "run: echo audit omitted"),
    ],
    ["read-only permissions", WORKFLOW.replace("contents: read", "contents: write")],
    ["GitHub token binding", WORKFLOW.replace("github.token", "secrets.GITHUB_TOKEN")],
    [
      "destructive command",
      WORKFLOW.replace(
        "      - name: Audit effective trunk protection",
        "      - name: Delete protection\n        run: gh api --method DELETE repos/croco-dev/framework/rulesets/1\n        env:\n          GH_TOKEN: ${{ github.token }}\n      - name: Audit effective trunk protection",
      ),
    ],
    [
      "custom shell default",
      WORKFLOW.replace(
        "  audit:\n    runs-on:",
        "  audit:\n    defaults:\n      run:\n        shell: true {0}\n    runs-on:",
      ),
    ],
    [
      "workflow environment override",
      WORKFLOW.replace(
        "permissions:\n  contents: read",
        "env:\n  NODE_OPTIONS: --import ./scripts/bypass.mjs\n\npermissions:\n  contents: read",
      ),
    ],
    [
      "job environment override",
      WORKFLOW.replace(
        "  audit:\n    runs-on:",
        "  audit:\n    env:\n      BASH_ENV: ./scripts/bypass.sh\n    runs-on:",
      ),
    ],
    ["runner", WORKFLOW.replace("runs-on: ubuntu-latest", "runs-on: self-hosted")],
    [
      "concurrency group",
      WORKFLOW.replace("group: repository-policy-audit", "group: repository-policy-audit-global"),
    ],
    [
      "concurrency cancellation",
      WORKFLOW.replace("cancel-in-progress: false", "cancel-in-progress: true"),
    ],
  ])("rejects a missing %s", (_name, mutation) => {
    expect(findRepositoryPolicyAuditWorkflowViolations(mutation)).not.toEqual([]);
  });

  it("rejects a conditional audit job", () => {
    const mutation = WORKFLOW.replace(
      "  audit:\n    runs-on:",
      "  audit:\n    if: github.event_name == 'workflow_dispatch'\n    runs-on:",
    );

    expect(findRepositoryPolicyAuditWorkflowViolations(mutation)).toContainEqual(
      expect.stringContaining("BRANCH_POLICY_AUDIT_JOB_SKIPPABLE"),
    );
  });
});

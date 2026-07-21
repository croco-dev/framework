import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { findWorkflowVerificationViolations } from "../workflow-verification-contract.mts";

const rootDir = resolve(__dirname, "../..");
const workflow = readFileSync(resolve(rootDir, ".github/workflows/release.yml"), "utf8");

describe("Release verification profile contract", () => {
  it("uses the shared classifier and one publish profile invocation", () => {
    expect(workflow).toContain("scripts/verification-change-classifier.mts");
    expect(workflow).toContain('--event "$GITHUB_EVENT_NAME"');
    expect(workflow).toContain("--workflow release");
    expect(workflow).toContain('echo "base=$base" >> "$GITHUB_OUTPUT"');
    expect(workflow).toContain(
      'if [ "$GITHUB_EVENT_NAME" != "workflow_dispatch" ]; then\n            args+=(--base "${{ steps.release_work.outputs.base }}" --head HEAD)',
    );
    expect(workflow).toContain('pnpm verify:publish -- "${args[@]}"');
    expect(workflow.match(/verify:publish/g)).toHaveLength(1);
    expect(workflow).not.toContain("test:release-gates");
    expect(workflow).not.toContain("--allow-pending-release-metadata");
  });

  it("runs every strict publish gate on manual dispatch", () => {
    expect(
      workflow.match(/if \[ "\$GITHUB_EVENT_NAME" != "workflow_dispatch" \]; then/g),
    ).toHaveLength(2);
    expect(workflow).toContain("args=(--output-dir ci-reports/release)");
  });

  it("keeps provenance authority and Changesets publishing in Actions", () => {
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain('NPM_CONFIG_PROVENANCE: "true"');
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain("uses: changesets/action@v1");
    expect(workflow).toContain(
      "if: steps.release_work.outputs.should_run_changesets_action == 'true'",
    );
  });

  it("preserves release report and artifact compatibility paths", () => {
    expect(workflow).toContain("ci-reports/release/spine-evidence.md");
    expect(workflow).toContain("name: release-spine-evidence");
    expect(workflow).toContain("path: ci-reports/release");
    expect(workflow).toContain("include-hidden-files: true");
  });

  it("contains no parallel or unknown verification commands", () => {
    expect(findWorkflowVerificationViolations(workflow, rootDir)).toEqual([]);
    expect(workflow).not.toContain("release_gate_maintenance_pattern");
  });

  it("rejects a manifest-owned alias inserted into Release", () => {
    const mutant = `${workflow}\n      - name: mutant\n        run: pnpm public-api:check\n`;
    expect(findWorkflowVerificationViolations(mutant, rootDir)).toMatchObject([
      { reason: "manifest-owned root alias: public-api:check" },
    ]);
  });

  it("rejects inline list-step profile overrides", () => {
    const mutant = `${workflow}\n  - run: pnpm verify:publish -- --profile repo\n`;
    expect(findWorkflowVerificationViolations(mutant, rootDir)).toMatchObject([
      { reason: "verification profile aliases cannot override --profile" },
    ]);
  });

  it.each([
    "pnpm install --frozen-lockfile && pnpm public-api:check",
    "pnpm verify:publish -- --profile repo",
    "pnpm verify:publish-extra",
    "node -e \"require('node:child_process').execSync('pnpm public-api:check')\"",
    "echo starting && pnpm public-api:check",
    "echo starting; pnpm public-api:check",
    "command pnpm public-api:check",
    "if pnpm public-api:check; then echo ok; fi",
  ])("rejects compound or prefix-bypass mutation %s", (command) => {
    const mutant = `${workflow}\n      - name: mutant\n        run: ${command}\n`;
    expect(findWorkflowVerificationViolations(mutant, rootDir)).not.toEqual([]);
  });
});

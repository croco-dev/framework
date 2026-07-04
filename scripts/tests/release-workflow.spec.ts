import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const releaseWorkflowPath = resolve(__dirname, "../../.github/workflows/release.yml");

const readReleaseWorkflow = () => readFileSync(releaseWorkflowPath, "utf-8");

const getWorkflowPattern = (variableName: string) => {
  const workflow = readReleaseWorkflow();
  const match = workflow.match(new RegExp(`${variableName}='([^']+)'`));

  expect(match, `${variableName} should be present`).not.toBeNull();

  return new RegExp(match?.[1] ?? "");
};

const getReleasePrUpdatePattern = () => getWorkflowPattern("release_pr_update_pattern");

const getReleasePrUpdateIgnorePattern = () =>
  getWorkflowPattern("release_pr_update_ignore_pattern");

const getPublishCandidatePattern = () => getWorkflowPattern("publish_candidate_pattern");

const getReleaseGateMaintenancePattern = () =>
  getWorkflowPattern("release_gate_maintenance_pattern");

const shouldUpdateReleasePr = (changedFiles: string[]) => {
  const releasePrUpdatePattern = getReleasePrUpdatePattern();
  const releasePrUpdateIgnorePattern = getReleasePrUpdateIgnorePattern();

  return changedFiles.some(
    (file) => !releasePrUpdateIgnorePattern.test(file) && releasePrUpdatePattern.test(file),
  );
};

const shouldRunPublishGates = (changedFiles: string[]) => {
  const publishCandidatePattern = getPublishCandidatePattern();

  return changedFiles.some((file) => publishCandidatePattern.test(file));
};

const shouldRunReleaseGateMaintenance = (changedFiles: string[]) => {
  const releaseGateMaintenancePattern = getReleaseGateMaintenancePattern();

  return changedFiles.some((file) => releaseGateMaintenancePattern.test(file));
};

describe("release workflow quality gates", () => {
  it("runs publish-blocking quality gates before dry-run publish and Changesets publish", () => {
    const workflow = readReleaseWorkflow();
    const orderedMarkers = [
      "- name: Install dependencies",
      "run: pnpm install --frozen-lockfile",
      "- name: Security allowlist metadata check",
      "run: pnpm security-allowlists:check",
      "- name: Production dependency audit",
      "run: pnpm security:audit-policy",
      "- name: Lint, format, and repository policy checks",
      "run: pnpm check",
      "- name: Verify npm provenance configuration",
      'npm_provenance="$(npm config get provenance)"',
      'pnpm_provenance="$(pnpm config get provenance)"',
      "- name: Release spine evidence",
      "run: pnpm release:spine-evidence",
      "- name: Publish release spine evidence summary",
      'cat ci-reports/release/spine-evidence.md >> "$GITHUB_STEP_SUMMARY"',
      "- name: Upload release spine evidence",
      "path: ci-reports/release",
      "- name: Dry-run publish gate",
      "run: pnpm -r publish --dry-run --no-git-checks",
      "- name: Create Release Pull Request or Publish",
      "uses: changesets/action@v1",
    ];

    let previousIndex = -1;
    for (const marker of orderedMarkers) {
      const index = workflow.indexOf(marker);
      expect(index, `${marker} should be present`).toBeGreaterThan(-1);
      expect(index, `${marker} should stay in release gate order`).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    const auditStepStart = workflow.indexOf("- name: Production dependency audit");
    const lintStepStart = workflow.indexOf("- name: Lint, format, and repository policy checks");
    const auditStep = workflow.slice(auditStepStart, lintStepStart);

    expect(auditStep).toContain(
      "if: steps.release_work.outputs.should_run_publish_gates == 'true'",
    );
    expect(auditStep).toContain("run: pnpm security:audit-policy");
    expect(auditStep).not.toContain("continue-on-error");
  });

  it("documents CI-only differences in the release job", () => {
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain("PR-only checks, secret-scan reports, and docs/coverage");
    expect(workflow).toContain(
      "Release routes dependency audit enforcement through the path-aware",
    );
    expect(workflow).toContain("publish-blocking risk is classified by manifest/runtime edge");
  });

  it("enforces npm provenance in the Changesets publish path", () => {
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain('NPM_CONFIG_PROVENANCE: "true"');
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain("NPM_CONFIG_PROVENANCE must resolve to true before publishing.");
    expect(workflow).toContain("id-token: write");
  });

  it("bounds the consolidated release spine evidence runtime", () => {
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain("release:spine-evidence has a 150-minute internal budget");
    expect(workflow).toContain("45-minute budgets for both publish setup/wrapper work");
    expect(workflow).toContain("release-gate maintenance self-check");
    expect(workflow).toContain("timeout-minutes: 240");
  });

  it("routes raw changesets to release PR updates without publish gates", () => {
    expect(shouldUpdateReleasePr([".changeset/new-version.md"])).toBe(true);
    expect(shouldUpdateReleasePr([".changeset/pre.json"])).toBe(true);
    expect(shouldUpdateReleasePr([".changeset/README.md"])).toBe(false);
    expect(shouldRunPublishGates([".changeset/new-version.md"])).toBe(false);
    expect(shouldRunPublishGates([".changeset/pre.json"])).toBe(false);
    expect(shouldRunPublishGates([".changeset/README.md"])).toBe(false);
    expect(shouldRunReleaseGateMaintenance([".changeset/new-version.md"])).toBe(false);
    expect(shouldRunReleaseGateMaintenance([".changeset/README.md"])).toBe(false);
  });

  it("routes versioned package and root publish candidates to publish gates", () => {
    const publishCandidateFiles = [
      "packages/framework-context/package.json",
      "packages/framework-context/CHANGELOG.md",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
    ];

    for (const file of publishCandidateFiles) {
      expect(shouldRunPublishGates([file]), `${file} should run publish gates`).toBe(true);
      expect(shouldUpdateReleasePr([file]), `${file} should not update release PR alone`).toBe(
        false,
      );
    }
  });

  it("runs both release PR updates and publish gates for mixed changeset and publish candidates", () => {
    const changedFiles = [".changeset/new-version.md", "pnpm-lock.yaml"];

    expect(shouldUpdateReleasePr(changedFiles)).toBe(true);
    expect(shouldRunPublishGates(changedFiles)).toBe(true);
  });

  it("keeps manual dispatch on both release PR update and publish-gate paths", () => {
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain('if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then');
    expect(workflow).toContain('echo "should_update_release_pr=true"');
    expect(workflow).toContain('echo "should_run_publish_gates=true"');
    expect(workflow).toContain('} >> "$GITHUB_OUTPUT"');
  });

  it("runs focused self-checks for release-gate maintenance changes", () => {
    const workflow = readReleaseWorkflow();
    const releaseGateFiles = [
      ".github/workflows/release.yml",
      "scripts/changeset-required-check.mts",
      "scripts/core-coverage-warning-check.mts",
      "scripts/create-croco-app-generated-smoke-support.mts",
      "scripts/create-croco-app-generated-smoke.mts",
      "scripts/dependency-audit-policy.mts",
      "scripts/first-success-verify.mts",
      "scripts/normalize-packages.mjs",
      "scripts/package-bin-smoke.mts",
      "scripts/package-entrypoint-smoke.mts",
      "scripts/package-manifest-contracts.mjs",
      "scripts/production-ready-check.mts",
      "scripts/provider-certification-check.mts",
      "scripts/public-api-surface.mts",
      "scripts/quick-start-lambda-smoke.mts",
      "scripts/release-docs-check.mts",
      "scripts/release-metadata-check.mts",
      "scripts/release-spine-evidence.mts",
      "scripts/security-allowlist-metadata-check.mts",
      "scripts/spine-promotion-check.mts",
      "scripts/tests/changeset-required-check.spec.ts",
      "scripts/tests/core-coverage-warning-check.spec.ts",
      "scripts/tests/create-croco-app-generated-smoke.spec.ts",
      "scripts/tests/dependency-audit-policy.spec.ts",
      "scripts/tests/first-success-verify.spec.ts",
      "scripts/tests/normalize-packages.spec.ts",
      "scripts/tests/package-bin-smoke.spec.ts",
      "scripts/tests/package-entrypoint-smoke.spec.ts",
      "scripts/tests/production-ready-check.spec.ts",
      "scripts/tests/provider-certification-check.spec.ts",
      "scripts/tests/public-api-surface.spec.ts",
      "scripts/tests/release-docs-check.spec.ts",
      "scripts/tests/release-metadata-check.spec.ts",
      "scripts/tests/release-spine-evidence.spec.ts",
      "scripts/tests/release-workflow.spec.ts",
      "scripts/tests/security-allowlist-metadata-check.spec.ts",
      "scripts/tests/spine-promotion-check.spec.ts",
    ];

    for (const file of releaseGateFiles) {
      expect(
        shouldRunReleaseGateMaintenance([file]),
        `${file} should trigger release gate maintenance`,
      ).toBe(true);
      expect(shouldUpdateReleasePr([file]), `${file} should not update release PR`).toBe(false);
      expect(shouldRunPublishGates([file]), `${file} should not be a publish candidate`).toBe(
        false,
      );
    }

    expect(workflow).toContain("- name: Release gate maintenance self-check");
    expect(workflow).toContain(
      "if: steps.release_work.outputs.should_verify_release_gate_maintenance == 'true'",
    );
    expect(workflow).toContain("pnpm exec vitest run scripts/tests/release-workflow.spec.ts");
    expect(workflow).toContain("scripts/tests/dependency-audit-policy.spec.ts");
    expect(workflow).toContain("scripts/tests/release-spine-evidence.spec.ts");
    expect(workflow).toContain("scripts/tests/release-metadata-check.spec.ts");
    expect(workflow).toContain("scripts/tests/security-allowlist-metadata-check.spec.ts");
    expect(workflow).toContain("scripts/tests/create-croco-app-generated-smoke.spec.ts");
    expect(workflow).toContain("scripts/tests/first-success-verify.spec.ts");
    expect(workflow).toContain("scripts/tests/provider-certification-check.spec.ts");
    expect(workflow).toContain("scripts/tests/production-ready-check.spec.ts");
    expect(workflow).toContain("scripts/tests/spine-promotion-check.spec.ts");
    expect(workflow).toContain("scripts/tests/core-coverage-warning-check.spec.ts");
    expect(workflow).toContain("scripts/tests/public-api-surface.spec.ts");
    expect(workflow).toContain("pnpm package-manifests:check");
    expect(workflow).toContain("pnpm provider-certification:check");
    expect(workflow).toContain("pnpm security-allowlists:check");
    expect(workflow).toContain("pnpm release-docs:check");
    expect(workflow).toContain(
      "node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets",
    );
    expect(workflow).toContain("pnpm package-entrypoints:smoke");
    expect(workflow).toContain("pnpm package-bins:smoke");
    expect(workflow).toContain("pnpm create-croco-app:smoke");
    expect(workflow).toContain("pnpm quick-start-lambda:smoke");
    expect(workflow).toContain("pnpm first-success:verify");
    expect(workflow).toContain("pnpm production-ready:check");
    expect(workflow).not.toContain("pnpm production-ready:check -- --require-task-summaries");
    expect(workflow).toContain("pnpm spine-promotion:check");
    expect(workflow).toContain("pnpm test:coverage:core:warning");
    expect(workflow).toContain("pnpm public-api:check");
    expect(workflow).toContain("if: steps.release_work.outputs.should_run_publish_gates == 'true'");
  });

  it("uses release:spine-evidence as the final consolidated spine gate before publish", () => {
    const workflow = readReleaseWorkflow();
    const spineGateIndex = workflow.indexOf("- name: Release spine evidence");
    const summaryIndex = workflow.indexOf("- name: Publish release spine evidence summary");
    const uploadIndex = workflow.indexOf("- name: Upload release spine evidence");
    const dryRunIndex = workflow.indexOf("- name: Dry-run publish gate");
    const spineGateStep = workflow.slice(spineGateIndex, summaryIndex);
    const summaryStep = workflow.slice(summaryIndex, uploadIndex);
    const uploadStep = workflow.slice(uploadIndex, dryRunIndex);

    expect(spineGateIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(spineGateIndex);
    expect(uploadIndex).toBeGreaterThan(summaryIndex);
    expect(dryRunIndex).toBeGreaterThan(spineGateIndex);
    expect(workflow).toContain("id: release_spine_evidence");
    expect(workflow).toContain("run: pnpm release:spine-evidence");
    expect(spineGateStep).toContain(
      "if: steps.release_work.outputs.should_run_publish_gates == 'true'",
    );
    expect(spineGateStep).not.toContain("always()");
    expect(summaryStep).toContain(
      "if: always() && steps.release_work.outputs.should_run_publish_gates == 'true'",
    );
    expect(uploadStep).toContain(
      "if: always() && steps.release_work.outputs.should_run_publish_gates == 'true'",
    );
    expect(workflow).toContain("name: release-spine-evidence");
    expect(workflow).toContain(
      "uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02",
    );
    expect(workflow).toContain("if-no-files-found: warn");
  });

  it("does not duplicate heavy gates already owned by release:spine-evidence", () => {
    const workflow = readReleaseWorkflow();
    const publishGateSection = workflow.slice(
      workflow.indexOf("- name: Production dependency audit"),
      workflow.indexOf("- name: Dry-run publish gate"),
    );

    expect(publishGateSection).not.toContain("- name: Build all packages");
    expect(publishGateSection).not.toContain("run: pnpm build");
    expect(publishGateSection).not.toContain("- name: Package entrypoint smoke");
    expect(publishGateSection).not.toContain("run: pnpm package-entrypoints:smoke");
    expect(publishGateSection).not.toContain("- name: Package binary smoke");
    expect(publishGateSection).not.toContain("run: pnpm package-bins:smoke");
    expect(publishGateSection).not.toContain("- name: TypeScript check");
    expect(publishGateSection).not.toContain("run: pnpm typecheck");
    expect(publishGateSection).not.toContain("- name: Test");
    expect(publishGateSection).not.toContain("run: pnpm test");
    expect(publishGateSection).not.toContain("- name: Release metadata check");
    expect(publishGateSection).not.toContain(
      "run: node --experimental-strip-types scripts/release-metadata-check.mts",
    );
  });

  it("skips non-release-only changes", () => {
    expect(shouldUpdateReleasePr(["RELEASING.md"])).toBe(false);
    expect(shouldUpdateReleasePr(["packages/framework-context/src/index.ts"])).toBe(false);
    expect(shouldUpdateReleasePr([".changeset/config.json"])).toBe(false);
    expect(shouldRunPublishGates(["RELEASING.md"])).toBe(false);
    expect(shouldRunPublishGates(["packages/framework-context/src/index.ts"])).toBe(false);
    expect(shouldRunPublishGates([".changeset/config.json"])).toBe(false);
    expect(shouldRunReleaseGateMaintenance(["RELEASING.md"])).toBe(false);
    expect(shouldRunReleaseGateMaintenance(["packages/framework-context/src/index.ts"])).toBe(
      false,
    );
    expect(shouldRunReleaseGateMaintenance([".changeset/config.json"])).toBe(false);
  });
});

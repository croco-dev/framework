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
      "- name: Production dependency audit",
      "run: pnpm audit:prod",
      "- name: Lint, format, and repository policy checks",
      "run: pnpm check",
      "- name: Build all packages",
      "run: pnpm build",
      "- name: Package entrypoint smoke",
      "run: pnpm package-entrypoints:smoke",
      "- name: Package binary smoke",
      "run: pnpm package-bins:smoke",
      "- name: TypeScript check",
      "run: pnpm typecheck",
      "- name: Test",
      "run: pnpm test",
      "- name: Verify npm provenance configuration",
      'npm_provenance="$(npm config get provenance)"',
      'pnpm_provenance="$(pnpm config get provenance)"',
      "- name: Release metadata check",
      "run: node --experimental-strip-types scripts/release-metadata-check.mts",
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
  });

  it("documents CI-only differences in the release job", () => {
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain("PR-only checks, secret-scan reports, and docs/coverage");
    expect(workflow).toContain("audit:prod intentionally ignores GHSA-gv7w-rqvm-qjhr");
  });

  it("enforces npm provenance in the Changesets publish path", () => {
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain('NPM_CONFIG_PROVENANCE: "true"');
    expect(workflow).toContain('registry-url: "https://registry.npmjs.org"');
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain("NPM_CONFIG_PROVENANCE must resolve to true before publishing.");
    expect(workflow).toContain("id-token: write");
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
      "scripts/normalize-packages.mjs",
      "scripts/package-bin-smoke.mts",
      "scripts/package-entrypoint-smoke.mts",
      "scripts/package-manifest-contracts.mjs",
      "scripts/release-docs-check.mts",
      "scripts/release-metadata-check.mts",
      "scripts/tests/changeset-required-check.spec.ts",
      "scripts/tests/normalize-packages.spec.ts",
      "scripts/tests/package-bin-smoke.spec.ts",
      "scripts/tests/package-entrypoint-smoke.spec.ts",
      "scripts/tests/release-docs-check.spec.ts",
      "scripts/tests/release-metadata-check.spec.ts",
      "scripts/tests/release-workflow.spec.ts",
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
    expect(workflow).toContain("scripts/tests/release-metadata-check.spec.ts");
    expect(workflow).toContain("pnpm package-manifests:check");
    expect(workflow).toContain("pnpm release-docs:check");
    expect(workflow).toContain(
      "node --experimental-strip-types scripts/release-metadata-check.mts --allow-pending-changesets",
    );
    expect(workflow).toContain("pnpm package-entrypoints:smoke");
    expect(workflow).toContain("pnpm package-bins:smoke");
    expect(workflow).toContain("if: steps.release_work.outputs.should_run_publish_gates == 'true'");
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

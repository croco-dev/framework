import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ciWorkflowPath = resolve(__dirname, "../../.github/workflows/ci.yml");

const readCiWorkflow = () => readFileSync(ciWorkflowPath, "utf-8");

describe("CI package quality dashboard", () => {
  it("collects package-level Turbo summaries before publishing the dashboard", () => {
    const workflow = readCiWorkflow();
    const orderedMarkers = [
      "- name: Build",
      "run: pnpm turbo run build --summarize --continue=always",
      "- name: TypeScript check",
      "run: pnpm turbo run typecheck --summarize --continue=always",
      "- name: Test",
      "run: pnpm turbo run test --summarize --continue=always",
      "- name: Provider certification gate",
      "run: |\n          set +e\n          pnpm provider-certification:check",
      "- name: Production-ready package gate",
      "production_ready_args+=(--require-task-summaries)",
      'pnpm production-ready:check -- "${production_ready_args[@]}"',
      "- name: Beta spine promotion gate",
      "pnpm spine-promotion:check",
      "- name: Publish package quality dashboard",
      "pnpm package-quality:report",
      "- name: Upload package quality dashboard",
      "name: package-quality-dashboard",
    ];

    let previousIndex = -1;
    for (const marker of orderedMarkers) {
      const index = workflow.indexOf(marker);
      expect(index, `${marker} should be present`).toBeGreaterThan(-1);
      expect(index, `${marker} should stay in dashboard order`).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }
  });

  it("passes step outcomes into the package quality dashboard", () => {
    const workflow = readCiWorkflow();

    expect(workflow).toContain(
      "PACKAGE_QUALITY_CHANGESET_STATUS: ${{ steps.changeset_required.outcome",
    );
    expect(workflow).toContain("PACKAGE_QUALITY_CHECK_STATUS: ${{ steps.lint_format_check.outcome");
    expect(workflow).toContain("PACKAGE_QUALITY_BUILD_STATUS: ${{ steps.build.outcome");
    expect(workflow).toContain("PACKAGE_QUALITY_TYPECHECK_STATUS: ${{ steps.typecheck.outcome");
    expect(workflow).toContain("PACKAGE_QUALITY_TEST_STATUS: ${{ steps.test.outcome");
    expect(workflow).toContain(
      "PACKAGE_QUALITY_PROVIDER_CERTIFICATION_STATUS: ${{ steps.provider_certification_gate.outcome",
    );
    expect(workflow).toContain(
      "PACKAGE_QUALITY_PRODUCTION_READY_STATUS: ${{ steps.production_ready_package_gate.outcome",
    );
    expect(workflow).toContain(
      "PACKAGE_QUALITY_SPINE_PROMOTION_STATUS: ${{ steps.spine_promotion_gate.outcome",
    );
  });

  it("appends the provider certification matrix before exiting the blocking gate", () => {
    const workflow = readCiWorkflow();

    expect(workflow).toContain("ci-reports/package-quality/provider-certification.md");
    expect(workflow).toContain("pnpm provider-certification:check");
    expect(workflow).toContain(
      'cat ci-reports/package-quality/provider-certification.md >> "$GITHUB_STEP_SUMMARY"',
    );
    expect(workflow).toContain('exit "$status"');
  });

  it("appends the production-ready package report before exiting the blocking gate", () => {
    const workflow = readCiWorkflow();

    expect(workflow).toContain("ci-reports/package-quality/production-ready.md");
    expect(workflow).toContain('if [ "${{ steps.build.outcome }}" != "skipped" ]');
    expect(workflow).toContain(
      'cat ci-reports/package-quality/production-ready.md >> "$GITHUB_STEP_SUMMARY"',
    );
    expect(workflow).toContain('exit "$status"');
  });

  it("appends the beta spine promotion report before exiting the blocking gate", () => {
    const workflow = readCiWorkflow();
    const gateStart = workflow.indexOf("- name: Beta spine promotion gate");
    const dashboardStart = workflow.indexOf("- name: Publish package quality dashboard");

    expect(gateStart, "beta spine promotion gate step should be present").toBeGreaterThan(-1);
    expect(
      dashboardStart,
      "package quality dashboard step should follow the beta spine promotion gate",
    ).toBeGreaterThan(gateStart);

    const gateStep = workflow.slice(gateStart, dashboardStart);
    const orderedMarkers = [
      "id: spine_promotion_gate",
      "pnpm spine-promotion:check",
      "status=$?",
      "ci-reports/package-quality/spine-promotion.md",
      'cat ci-reports/package-quality/spine-promotion.md >> "$GITHUB_STEP_SUMMARY"',
      'exit "$status"',
    ];

    let previousIndex = -1;
    for (const marker of orderedMarkers) {
      const index = gateStep.indexOf(marker);
      expect(index, `${marker} should be present in the beta spine promotion gate`).toBeGreaterThan(
        -1,
      );
      expect(index, `${marker} should stay in beta spine promotion gate order`).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
  });

  it("publishes generated app smoke matrix artifacts after the smoke gate", () => {
    const workflow = readCiWorkflow();
    const orderedMarkers = [
      "- name: create-croco-app generated app smoke",
      "run: pnpm create-croco-app:smoke",
      "- name: Publish generated app smoke summary",
      "ci-reports/generated-apps/matrix.md",
      "- name: Upload generated app smoke report",
      "name: generated-app-smoke-report",
      "path: ci-reports/generated-apps",
      "- name: TypeScript check",
    ];

    let previousIndex = -1;
    for (const marker of orderedMarkers) {
      const index = workflow.indexOf(marker);
      expect(index, `${marker} should be present`).toBeGreaterThan(-1);
      expect(index, `${marker} should stay after generated app smoke`).toBeGreaterThan(
        previousIndex,
      );
      previousIndex = index;
    }
  });

  it("excludes intentionally archived OpenAI API docs snapshots from docs link checks", () => {
    const workflow = readCiWorkflow();

    expect(workflow).toContain(
      "--exclude '^https://web\\.archive\\.org/web/[0-9]+/https://developers\\.openai\\.com/api/'",
    );
  });

  it("keeps core coverage hard errors blocking in CI", () => {
    const workflow = readCiWorkflow();
    const warningStepStart = workflow.indexOf("- name: Core package coverage warning report");
    const summaryStepStart = workflow.indexOf("- name: Publish core coverage warning summary");

    expect(warningStepStart, "core coverage warning report step should be present").toBeGreaterThan(
      -1,
    );
    expect(
      summaryStepStart,
      "core coverage summary step should follow the warning report",
    ).toBeGreaterThan(warningStepStart);

    const warningStep = workflow.slice(warningStepStart, summaryStepStart);
    expect(warningStep).toContain("run: pnpm test:coverage:core:warning");
    expect(warningStep).not.toContain("continue-on-error");
  });

  it("triggers docs link checks for root docs and public package READMEs", () => {
    const workflow = readCiWorkflow();
    const docsFilterStart = workflow.indexOf("            docs:\n");
    const apiSourceFilterStart = workflow.indexOf("            api-source:\n");

    expect(docsFilterStart, "docs path filter should be present").toBeGreaterThan(-1);
    expect(apiSourceFilterStart, "api-source path filter should follow docs").toBeGreaterThan(
      docsFilterStart,
    );

    const docsFilter = workflow.slice(docsFilterStart, apiSourceFilterStart);
    expect(docsFilter).toContain("- 'README.md'");
    expect(docsFilter).toContain("- 'docs/**/*.md'");
    expect(docsFilter).toContain("- 'packages/*/README.md'");
    expect(docsFilter).toContain("- 'packages/docs/**'");
  });

  it("checks built docs, root docs, and public package READMEs with Lychee", () => {
    const workflow = readCiWorkflow();
    const linkCheckerStart = workflow.indexOf("- name: Link Checker");
    const linkCheckerEnd = workflow.indexOf("        env:", linkCheckerStart);

    expect(linkCheckerStart, "Lychee link checker step should be present").toBeGreaterThan(-1);
    expect(linkCheckerEnd, "Lychee env block should follow args").toBeGreaterThan(linkCheckerStart);

    const linkChecker = workflow.slice(linkCheckerStart, linkCheckerEnd);
    expect(linkChecker).toContain("repository landing URL");
    expect(linkChecker).toContain("current-commit blob/tree links");
    expect(linkChecker).toContain("your-org/croco is scaffold placeholder text");
    expect(linkChecker).toContain("diataxis.fr rate-limits");
    expect(linkChecker).toContain("private docs app");
    expect(linkChecker).toContain("rather than a public package README");
    expect(linkChecker).toContain("--root-dir '${{ github.workspace }}/packages/docs/dist'");
    expect(linkChecker).toContain(
      "--exclude '^https://github\\.com/croco-dev/framework(#readme)?$'",
    );
    expect(linkChecker).toContain(
      "--exclude '^https://github\\.com/croco-dev/framework/(blob|tree)/[0-9a-f]{40}/'",
    );
    expect(linkChecker).toContain("--exclude '^https://github\\.com/your-org/croco(#readme)?$'");
    expect(linkChecker).toContain("--exclude '^https://diataxis\\.fr/(how-to-guides|reference)/$'");
    expect(linkChecker).toContain("--exclude-path '(^|/)packages/docs/README\\.md$'");
    expect(linkChecker).toContain("'README.md'");
    expect(linkChecker).toContain("'docs/**/*.md'");
    expect(linkChecker).toContain("'packages/*/README.md'");
    expect(linkChecker).toContain("'packages/docs/dist/**/*.html'");
  });
});

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
  });
});

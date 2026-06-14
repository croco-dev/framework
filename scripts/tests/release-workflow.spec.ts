import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const releaseWorkflowPath = resolve(__dirname, "../../.github/workflows/release.yml");

describe("release workflow quality gates", () => {
  it("runs publish-blocking quality gates before dry-run publish and Changesets", () => {
    const workflow = readFileSync(releaseWorkflowPath, "utf-8");
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
      "- name: TypeScript check",
      "run: pnpm typecheck",
      "- name: Test",
      "run: pnpm test",
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
    const workflow = readFileSync(releaseWorkflowPath, "utf-8");

    expect(workflow).toContain("PR-only checks, secret-scan reports, and docs/coverage");
    expect(workflow).toContain("audit:prod intentionally ignores GHSA-gv7w-rqvm-qjhr");
  });
});

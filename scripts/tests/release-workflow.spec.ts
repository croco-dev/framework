import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const releaseWorkflowPath = resolve(__dirname, "../../.github/workflows/release.yml");

const readReleaseWorkflow = () => readFileSync(releaseWorkflowPath, "utf-8");

const getReleaseWorkPattern = () => {
  const workflow = readReleaseWorkflow();
  const match = workflow.match(/release_work_pattern='([^']+)'/);

  expect(match, "release_work_pattern should be present").not.toBeNull();

  return new RegExp(match?.[1] ?? "");
};

const shouldRunReleaseWork = (changedFiles: string[]) => {
  const releaseWorkPattern = getReleaseWorkPattern();

  return changedFiles.some((file) => releaseWorkPattern.test(file));
};

describe("release workflow quality gates", () => {
  it("runs publish-blocking quality gates before dry-run publish and Changesets", () => {
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
    const workflow = readReleaseWorkflow();

    expect(workflow).toContain("PR-only checks, secret-scan reports, and docs/coverage");
    expect(workflow).toContain("audit:prod intentionally ignores GHSA-gv7w-rqvm-qjhr");
  });

  it("runs for Changesets prerelease state changes", () => {
    expect(shouldRunReleaseWork([".changeset/pre.json"])).toBe(true);
  });

  it("keeps existing release-work file triggers", () => {
    expect(shouldRunReleaseWork([".changeset/new-version.md"])).toBe(true);
    expect(shouldRunReleaseWork(["packages/framework-context/package.json"])).toBe(true);
    expect(shouldRunReleaseWork(["packages/framework-context/CHANGELOG.md"])).toBe(true);
    expect(shouldRunReleaseWork(["package.json"])).toBe(true);
    expect(shouldRunReleaseWork(["pnpm-lock.yaml"])).toBe(true);
  });

  it("skips non-release-only changes", () => {
    expect(shouldRunReleaseWork(["RELEASING.md"])).toBe(false);
    expect(shouldRunReleaseWork(["packages/framework-context/src/index.ts"])).toBe(false);
    expect(shouldRunReleaseWork([".changeset/config.json"])).toBe(false);
  });
});

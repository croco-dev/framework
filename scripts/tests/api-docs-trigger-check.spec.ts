import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../api-docs-trigger-check.mts");
const tempRoots: string[] = [];
const sharedApiSourceGlobs = [
  "packages/*/package.json",
  ".oxfmtrc.json",
  "pnpm-lock.yaml",
  "turbo.json",
  "packages/docs/api-docs.config.mjs",
  "packages/docs/astro.config.mjs",
  "packages/docs/src/content.config.ts",
  "packages/docs/scripts/build-docs.mts",
  "packages/docs/scripts/generate-package-api-model.mts",
  "packages/docs/scripts/prepare-api-models.mjs",
  "packages/docs/scripts/sanitize-typedoc-index.mjs",
  "packages/docs/scripts/typedoc-merge-normalizer.mjs",
] as const;

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("api-docs-trigger-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("fails when generated API docs include a package missing from the CI api-source filter", () => {
    const root = createTempRoot();
    writeDocumentedPackage(root, "billing-core");
    writeDocumentedPackage(root, "retry-core");
    writeWorkflow(root, ["packages/retry-core/src/**", ...sharedApiSourceGlobs]);

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("api-docs-trigger-check: CI API docs trigger drift detected");
    expect(result.stdout).toContain("missing generated API docs source globs");
    expect(result.stdout).toContain("packages/billing-core/src/**");
  });

  it("writes the CI api-source filter from generated API docs directories", () => {
    const root = createTempRoot();
    writeDocumentedPackage(root, "billing-core");
    writeDocumentedPackage(root, "retry-core");
    const workflowPath = writeWorkflow(root, [
      "packages/retry-core/src/**",
      ...sharedApiSourceGlobs,
    ]);

    const result = runScript(root, "--write");
    const workflow = readFileSync(workflowPath, "utf-8");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CI API docs triggers match generated API docs surface");
    expect(workflow).toContain("api-source:");
    expect(workflow).toContain("- 'packages/billing-core/src/**'");
    expect(workflow).toContain("- 'packages/retry-core/src/**'");
    for (const glob of sharedApiSourceGlobs) {
      expect(workflow).toContain(`- '${glob}'`);
    }
  });

  it("passes when the CI api-source filter matches generated API docs directories", () => {
    const root = createTempRoot();
    writeDocumentedPackage(root, "billing-core");
    writeDocumentedPackage(root, "retry-core");
    writeWorkflow(root, [
      "packages/billing-core/src/**",
      "packages/retry-core/src/**",
      ...sharedApiSourceGlobs,
    ]);

    const result = runScript(root, "--check");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CI API docs triggers match generated API docs surface");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-api-docs-trigger-"));
  tempRoots.push(root);
  mkdirSync(join(root, ".github", "workflows"), { recursive: true });
  mkdirSync(join(root, "packages", "docs", "src", "content", "docs", "api"), {
    recursive: true,
  });
  return root;
}

function writeDocumentedPackage(root: string, packageName: string): void {
  mkdirSync(join(root, "packages", packageName, "src"), { recursive: true });
  mkdirSync(join(root, "packages", "docs", "src", "content", "docs", "api", packageName), {
    recursive: true,
  });
  writeFileSync(
    join(root, "packages", packageName, "package.json"),
    `${JSON.stringify({ name: `@croco/${packageName}` }, null, 2)}\n`,
  );
  writeFileSync(join(root, "packages", packageName, "src", "index.ts"), "export {};\n");
}

function writeWorkflow(root: string, apiSourceGlobs: readonly string[]): string {
  const workflowPath = join(root, ".github", "workflows", "ci.yml");
  const apiSourceLines = apiSourceGlobs.map((glob) => `              - '${glob}'`).join("\n");
  writeFileSync(
    workflowPath,
    `name: CI

jobs:
  changes:
    runs-on: ubuntu-latest
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            docs:
              - 'packages/docs/**'
            api-source:
${apiSourceLines}
`,
  );
  return workflowPath;
}

function runScript(root: string, mode: "--check" | "--write"): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, mode, "--root", root],
    {
      encoding: "utf-8",
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

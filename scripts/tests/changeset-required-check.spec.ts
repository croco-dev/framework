import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../changeset-required-check.mts");
const tempRepos: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

type RunScriptOptions = {
  readonly env?: Record<string, string>;
};

describe("changeset-required-check.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("fails when public package source changes without a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/source-without-changeset");
    commitFile(
      repo,
      "packages/public/src/index.ts",
      "export const value = 2;",
      "fix: change public package",
    );

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "changeset-required: publishable package changes require a non-README changeset.",
    );
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/src/index.ts");
  });

  it("passes when public package source changes with a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/source-with-changeset");
    commitFile(
      repo,
      "packages/public/src/index.ts",
      "export const value = 2;",
      "fix: change public package",
    );
    commitFile(
      repo,
      ".changeset/public-source.md",
      "---\n'@croco/public': patch\n---\n\nFix public behavior.\n",
      "chore: add changeset",
    );

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: valid non-README changeset found (passing)",
    );
  });

  it("fails when public package source changes with an invalid changeset file", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/source-with-invalid-changeset");
    commitFile(
      repo,
      "packages/public/src/index.ts",
      "export const value = 2;",
      "fix: change public package",
    );
    commitFile(
      repo,
      ".changeset/empty.md",
      "Missing frontmatter.\n",
      "chore: add invalid changeset",
    );

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "changeset-required: publishable package changes require a non-README changeset.",
    );
  });

  it("does not count .changeset/README.md as a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/readme-only-changeset");
    commitFile(
      repo,
      "packages/public/src/index.ts",
      "export const value = 2;",
      "fix: change public package",
    );
    commitFile(
      repo,
      ".changeset/README.md",
      "# Changesets\n\nDocs only.\n",
      "docs: update changeset docs",
    );

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "changeset-required: publishable package changes require a non-README changeset.",
    );
  });

  it("fails when public package source files are deleted without a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/delete-public-source");
    git(repo, ["rm", "packages/public/src/index.ts"]);
    git(repo, ["commit", "-m", "fix: delete public source"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/src/index.ts");
  });

  it("fails when public package template markdown changes without a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/template-markdown");
    commitFile(
      repo,
      "packages/public/templates/addons/AGENTS.md",
      "# Agent rules\n",
      "fix: update generated agent rules",
    );

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/templates/addons/AGENTS.md");
  });

  it("passes for public package docs-only changes", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "docs/package-readme");
    commitFile(
      repo,
      "packages/public/README.md",
      "# Public docs\n",
      "docs: update public package docs",
    );

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: no publishable package behavior changes detected (passing)",
    );
  });

  it("passes for private docs-site source changes", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "docs/site-content");
    commitFile(
      repo,
      "packages/docs/src/content/docs/guide.md",
      "# Guide\n",
      "docs: update site guide",
    );

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: no publishable package behavior changes detected (passing)",
    );
  });

  it("passes for public package test-only changes", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "test/public-package");
    commitFile(
      repo,
      "packages/public/src/__tests__/Public.spec.ts",
      "export const testValue = 1;",
      "test: cover public package",
    );

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: no publishable package behavior changes detected (passing)",
    );
  });

  it("passes for private package source changes", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "feature/private-package");
    commitFile(
      repo,
      "packages/private/src/index.ts",
      "export const value = 2;",
      "fix: change private package",
    );

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: no publishable package behavior changes detected (passing)",
    );
  });

  it("passes for root lockfile-only changes", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "chore/lockfile");
    commitFile(repo, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n", "chore: update lockfile");

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: no publishable package behavior changes detected (passing)",
    );
  });

  it("fails when a public package manifest changes without a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/package-manifest");
    const packagePath = join(repo, "packages/public/package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
    pkg.dependencies = {
      "@croco/example": "workspace:*",
    };
    writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
    git(repo, ["add", "packages/public/package.json"]);
    git(repo, ["commit", "-m", "fix: update public package contract"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/package.json");
  });

  it("fails when the public API snapshot changes without release metadata", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/public-api-snapshot-without-changeset");
    writePublicApiSnapshot(repo, ["nextValue"]);
    git(repo, ["add", "public-api-surface.snapshot.json"]);
    git(repo, ["commit", "-m", "fix: update public api snapshot"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "changeset-required: publishable package changes require a non-README changeset.",
    );
    expect(result.stdout).toContain("@croco/public (public API snapshot)");
    expect(result.stdout).toContain("public-api-surface.snapshot.json");
  });

  it("passes when the public API snapshot changes with a release changeset", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/public-api-snapshot-with-changeset");
    writePublicApiSnapshot(repo, ["nextValue"]);
    git(repo, ["add", "public-api-surface.snapshot.json"]);
    git(repo, ["commit", "-m", "fix: update public api snapshot"]);
    commitFile(
      repo,
      ".changeset/public-api-snapshot.md",
      "---\n'@croco/public': patch\n---\n\nUpdate public API snapshot.\n",
      "chore: add public api changeset",
    );

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: valid non-README changeset found (passing)",
    );
  });

  it("passes when a snapshot-only correction carries a checked no-release reason", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/public-api-snapshot-no-release");
    writePublicApiSnapshot(repo, ["nextValue"]);
    git(repo, ["add", "public-api-surface.snapshot.json"]);
    git(repo, ["commit", "-m", "fix: update public api snapshot"]);
    writeFile(
      repo,
      "event.json",
      JSON.stringify({
        pull_request: {
          body: "## Summary\n\nChangeset-required no-release reason: Snapshot normalization only; package source and runtime behavior are unchanged.",
        },
      }),
    );

    const result = runScript(repo, {
      env: {
        GITHUB_EVENT_PATH: "event.json",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: public API snapshot change has checked no-release justification (passing)",
    );
    expect(result.stdout).toContain("No-release source: pull request body");
  });

  it("fails when a snapshot-only correction only has an environment no-release reason", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/public-api-snapshot-env-no-release");
    writePublicApiSnapshot(repo, ["nextValue"]);
    git(repo, ["add", "public-api-surface.snapshot.json"]);
    git(repo, ["commit", "-m", "fix: update public api snapshot"]);

    const result = runScript(repo, {
      env: {
        CHANGESET_REQUIRED_NO_RELEASE_REASON:
          "Snapshot normalization only; package source and runtime behavior are unchanged.",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "changeset-required: publishable package changes require a non-README changeset.",
    );
    expect(result.stdout).toContain("@croco/public (public API snapshot)");
  });

  it("does not let a no-release reason bypass public package source changes", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/source-change-with-no-release-reason");
    commitFile(
      repo,
      "packages/public/src/index.ts",
      "export const value = 2;",
      "fix: change public package",
    );
    writeFile(
      repo,
      "event.json",
      JSON.stringify({
        pull_request: {
          body: "## Summary\n\nChangeset-required no-release reason: Snapshot normalization only; package source and runtime behavior are unchanged.",
        },
      }),
    );

    const result = runScript(repo, {
      env: {
        GITHUB_EVENT_PATH: "event.json",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/src/index.ts");
  });
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-changeset-required-"));
  tempRepos.push(repo);

  git(repo, ["init", "--initial-branch=trunk"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  git(repo, ["config", "user.name", "Test User"]);
  git(repo, ["config", "commit.gpgsign", "false"]);
  git(repo, ["config", "tag.gpgsign", "false"]);
  git(repo, ["config", "core.hooksPath", "/dev/null"]);
  git(repo, ["config", "advice.detachedHead", "false"]);

  writeFile(repo, "package.json", '{"name":"fixture","private":true}\n');
  writeFile(repo, ".changeset/README.md", "# Changesets\n");
  writePackage(repo, "public", {
    name: "@croco/public",
    version: "0.0.3",
    publishConfig: {
      access: "public",
    },
  });
  writePackage(repo, "private", {
    name: "@croco/private",
    private: true,
    version: "0.0.0",
  });
  writePackage(repo, "docs", {
    name: "@croco/docs",
    private: true,
    version: "0.0.2",
  });
  writePublicApiSnapshot(repo, ["value"]);

  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "chore: initial commit"]);

  return repo;
}

function writePackage(repo: string, packageDirName: string, pkg: Record<string, unknown>): void {
  writeFile(repo, `packages/${packageDirName}/package.json`, `${JSON.stringify(pkg, null, 2)}\n`);
  writeFile(repo, `packages/${packageDirName}/src/index.ts`, "export const value = 1;\n");
}

function writePublicApiSnapshot(repo: string, runtimeExportNames: readonly string[]): void {
  writeFile(
    repo,
    "public-api-surface.snapshot.json",
    `${JSON.stringify(
      {
        schemaVersion: 1,
        packages: [
          {
            packageName: "@croco/public",
            relativeDir: "packages/public",
            entrypoint: "packages/public/src/index.ts",
            runtimeExports: runtimeExportNames.map((name) => ({
              name,
              exportKind: "named",
              source: "./index.js",
              declarationKind: "const",
            })),
            typeExports: [],
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

function checkoutBranch(repo: string, branch: string): void {
  git(repo, ["checkout", "-b", branch]);
}

function commitFile(repo: string, fileName: string, content: string, subject: string): void {
  writeFile(repo, fileName, `${content}\n`);
  git(repo, ["add", fileName]);
  git(repo, ["commit", "-m", subject]);
}

function writeFile(repo: string, fileName: string, content: string): void {
  const filePath = join(repo, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runScript(repo: string, options: RunScriptOptions = {}): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, "--root", repo, "--base", "trunk", "--head", "HEAD"],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        ...options.env,
      },
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", [...args], {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2024-01-01T00:00:00Z",
      GIT_COMMITTER_DATE: "2024-01-01T00:00:00Z",
    },
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

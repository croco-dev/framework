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

  it("passes generated Changesets version metadata that consumes pending changesets", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/public-version.md",
      "---\n'@croco/public': patch\n---\n\nRelease public package behavior.\n",
      "chore: add pending changeset",
    );
    checkoutBranch(repo, "version-packages");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
      dependencies: {
        "@croco/dependency": "^0.0.3",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Release public package behavior.\n",
    );
    git(repo, ["rm", ".changeset/public-version.md"]);
    git(repo, ["add", "packages/public/package.json", "packages/public/CHANGELOG.md"]);
    git(repo, ["commit", "-m", "chore: version packages"]);

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: generated Changesets version metadata found (passing)",
    );
  });

  it("passes generated internal dependency metadata for packages versioned together", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/public-version.md",
      "---\n'@croco/public': patch\n'@croco/dependency': patch\n---\n\nRelease linked public package behavior.\n",
      "chore: add pending changeset",
    );
    checkoutBranch(repo, "version-linked-packages");
    writePackageJson(repo, "dependency", {
      name: "@croco/dependency",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
      dependencies: {
        "@croco/dependency": "^0.0.4",
      },
    });
    writeFile(
      repo,
      "packages/dependency/CHANGELOG.md",
      "# @croco/dependency\n\n## 0.0.4\n\n### Patch Changes\n\n- Release linked public package behavior.\n",
    );
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Updated dependencies.\n",
    );
    git(repo, ["rm", ".changeset/public-version.md"]);
    git(repo, [
      "add",
      "packages/dependency/package.json",
      "packages/dependency/CHANGELOG.md",
      "packages/public/package.json",
      "packages/public/CHANGELOG.md",
    ]);
    git(repo, ["commit", "-m", "chore: version linked packages"]);

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: generated Changesets version metadata found (passing)",
    );
  });

  it("passes generated dependent metadata when only the dependency has a consumed changeset", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/dependency-version.md",
      "---\n'@croco/dependency': patch\n---\n\nRelease dependency package behavior.\n",
      "chore: add dependency pending changeset",
    );
    checkoutBranch(repo, "version-dependent-package");
    writePackageJson(repo, "dependency", {
      name: "@croco/dependency",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
      dependencies: {
        "@croco/dependency": "^0.0.4",
      },
    });
    writeFile(
      repo,
      "packages/dependency/CHANGELOG.md",
      "# @croco/dependency\n\n## 0.0.4\n\n### Patch Changes\n\n- Release dependency package behavior.\n",
    );
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Updated dependencies.\n",
    );
    git(repo, ["rm", ".changeset/dependency-version.md"]);
    git(repo, [
      "add",
      "packages/dependency/package.json",
      "packages/dependency/CHANGELOG.md",
      "packages/public/package.json",
      "packages/public/CHANGELOG.md",
    ]);
    git(repo, ["commit", "-m", "chore: version dependency and dependent"]);

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: generated Changesets version metadata found (passing)",
    );
  });

  it("passes generated dependent metadata with unchanged workspace dependency ranges", () => {
    const repo = createTempRepo();
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.3",
      publishConfig: {
        access: "public",
      },
      dependencies: {
        "@croco/dependency": "workspace:*",
      },
    });
    git(repo, ["add", "packages/public/package.json"]);
    git(repo, ["commit", "-m", "test: use workspace dependency range"]);
    commitFile(
      repo,
      ".changeset/dependency-version.md",
      "---\n'@croco/dependency': patch\n---\n\nRelease dependency package behavior.\n",
      "chore: add dependency pending changeset",
    );
    checkoutBranch(repo, "version-workspace-dependent-package");
    writePackageJson(repo, "dependency", {
      name: "@croco/dependency",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
      dependencies: {
        "@croco/dependency": "workspace:*",
      },
    });
    writeFile(
      repo,
      "packages/dependency/CHANGELOG.md",
      "# @croco/dependency\n\n## 0.0.4\n\n### Patch Changes\n\n- Release dependency package behavior.\n",
    );
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Updated dependencies.\n",
    );
    git(repo, ["rm", ".changeset/dependency-version.md"]);
    git(repo, [
      "add",
      "packages/dependency/package.json",
      "packages/dependency/CHANGELOG.md",
      "packages/public/package.json",
      "packages/public/CHANGELOG.md",
    ]);
    git(repo, ["commit", "-m", "chore: version workspace dependency and dependent"]);

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: generated Changesets version metadata found (passing)",
    );
  });

  it("passes generated create-croco-app range metadata for versioned Croco packages", () => {
    const repo = createTempRepo();
    writePackage(repo, "create-croco-app", {
      name: "create-croco-app",
      version: "0.0.3",
      publishConfig: {
        access: "public",
      },
    });
    writeCreateCrocoAppRanges(repo, {
      "@croco/dependency": "^0.0.3",
    });
    git(repo, ["add", "packages/create-croco-app"]);
    git(repo, ["commit", "-m", "chore: add generated app range metadata"]);
    commitFile(
      repo,
      ".changeset/create-app-ranges.md",
      "---\n'@croco/dependency': patch\n'create-croco-app': minor\n---\n\nRelease generated app range metadata.\n",
      "chore: add generated app range changeset",
    );
    checkoutBranch(repo, "version-create-app-ranges");
    writePackageJson(repo, "dependency", {
      name: "@croco/dependency",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writePackageJson(repo, "create-croco-app", {
      name: "create-croco-app",
      version: "0.1.0",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/dependency/CHANGELOG.md",
      "# @croco/dependency\n\n## 0.0.4\n\n### Patch Changes\n\n- Release generated app range metadata.\n",
    );
    writeFile(
      repo,
      "packages/create-croco-app/CHANGELOG.md",
      "# create-croco-app\n\n## 0.1.0\n\n### Minor Changes\n\n- Release generated app range metadata.\n",
    );
    writeCreateCrocoAppRanges(repo, {
      "@croco/dependency": "^0.0.4",
    });
    git(repo, ["rm", ".changeset/create-app-ranges.md"]);
    git(repo, [
      "add",
      "packages/dependency/package.json",
      "packages/dependency/CHANGELOG.md",
      "packages/create-croco-app/package.json",
      "packages/create-croco-app/CHANGELOG.md",
      "packages/create-croco-app/src/helpers/croco-ranges.ts",
    ]);
    git(repo, ["commit", "-m", "chore: version generated app ranges"]);

    const result = runScript(repo);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "changeset-required: generated Changesets version metadata found (passing)",
    );
  });

  it("fails generated create-croco-app range metadata when the range does not match the versioned package", () => {
    const repo = createTempRepo();
    writePackage(repo, "create-croco-app", {
      name: "create-croco-app",
      version: "0.0.3",
      publishConfig: {
        access: "public",
      },
    });
    writeCreateCrocoAppRanges(repo, {
      "@croco/dependency": "^0.0.3",
    });
    git(repo, ["add", "packages/create-croco-app"]);
    git(repo, ["commit", "-m", "chore: add generated app range metadata"]);
    commitFile(
      repo,
      ".changeset/create-app-ranges.md",
      "---\n'@croco/dependency': patch\n'create-croco-app': minor\n---\n\nRelease generated app range metadata.\n",
      "chore: add generated app range changeset",
    );
    checkoutBranch(repo, "version-invalid-create-app-ranges");
    writePackageJson(repo, "dependency", {
      name: "@croco/dependency",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writePackageJson(repo, "create-croco-app", {
      name: "create-croco-app",
      version: "0.1.0",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/dependency/CHANGELOG.md",
      "# @croco/dependency\n\n## 0.0.4\n\n### Patch Changes\n\n- Release generated app range metadata.\n",
    );
    writeFile(
      repo,
      "packages/create-croco-app/CHANGELOG.md",
      "# create-croco-app\n\n## 0.1.0\n\n### Minor Changes\n\n- Release generated app range metadata.\n",
    );
    writeCreateCrocoAppRanges(repo, {
      "@croco/dependency": "^0.0.5",
    });
    git(repo, ["rm", ".changeset/create-app-ranges.md"]);
    git(repo, [
      "add",
      "packages/dependency/package.json",
      "packages/dependency/CHANGELOG.md",
      "packages/create-croco-app/package.json",
      "packages/create-croco-app/CHANGELOG.md",
      "packages/create-croco-app/src/helpers/croco-ranges.ts",
    ]);
    git(repo, ["commit", "-m", "chore: version invalid generated app ranges"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("create-croco-app");
    expect(result.stdout).toContain("packages/create-croco-app/src/helpers/croco-ranges.ts");
  });

  it("fails generated-looking version metadata when no pending changeset was consumed", () => {
    const repo = createTempRepo();
    checkoutBranch(repo, "fix/manual-version-bump");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Manual version bump.\n",
    );
    git(repo, ["add", "packages/public/package.json", "packages/public/CHANGELOG.md"]);
    git(repo, ["commit", "-m", "chore: bump package version"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/package.json");
  });

  it("fails generated-looking version metadata when consumed changesets cover another package", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/other-version.md",
      "---\n'@croco/other': patch\n---\n\nRelease other package behavior.\n",
      "chore: add unrelated pending changeset",
    );
    checkoutBranch(repo, "fix/unrelated-consumed-changeset");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Manual version bump.\n",
    );
    git(repo, ["rm", ".changeset/other-version.md"]);
    git(repo, ["add", "packages/public/package.json", "packages/public/CHANGELOG.md"]);
    git(repo, ["commit", "-m", "chore: bump wrong package version"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/package.json");
  });

  it("fails generated-looking version metadata when the version does not increase", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/public-version.md",
      "---\n'@croco/public': patch\n---\n\nRelease public package behavior.\n",
      "chore: add pending changeset",
    );
    checkoutBranch(repo, "fix/version-downgrade");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.2",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.2\n\n### Patch Changes\n\n- Invalid downgrade.\n",
    );
    git(repo, ["rm", ".changeset/public-version.md"]);
    git(repo, ["add", "packages/public/package.json", "packages/public/CHANGELOG.md"]);
    git(repo, ["commit", "-m", "chore: downgrade package version"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/package.json");
  });

  it("fails generated-looking version metadata when the changelog omits the head version", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/public-version.md",
      "---\n'@croco/public': patch\n---\n\nRelease public package behavior.\n",
      "chore: add pending changeset",
    );
    checkoutBranch(repo, "fix/changelog-without-version");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n### Patch Changes\n\n- Missing version header.\n",
    );
    git(repo, ["rm", ".changeset/public-version.md"]);
    git(repo, ["add", "packages/public/package.json", "packages/public/CHANGELOG.md"]);
    git(repo, ["commit", "-m", "chore: bump package without changelog version"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/package.json");
  });

  it("fails generated-looking dependency metadata when the dependency was not versioned", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/public-version.md",
      "---\n'@croco/public': patch\n---\n\nRelease public package behavior.\n",
      "chore: add pending changeset",
    );
    checkoutBranch(repo, "fix/manual-internal-dependency-range");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
      dependencies: {
        "@croco/dependency": "^0.0.4",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Manual dependency range.\n",
    );
    git(repo, ["rm", ".changeset/public-version.md"]);
    git(repo, ["add", "packages/public/package.json", "packages/public/CHANGELOG.md"]);
    git(repo, ["commit", "-m", "chore: bump dependency range"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/package.json");
  });

  it("does not let consumed version metadata bypass public source changes", () => {
    const repo = createTempRepo();
    commitFile(
      repo,
      ".changeset/public-version.md",
      "---\n'@croco/public': patch\n---\n\nRelease public package behavior.\n",
      "chore: add pending changeset",
    );
    checkoutBranch(repo, "fix/version-and-source");
    writePackageJson(repo, "public", {
      name: "@croco/public",
      version: "0.0.4",
      publishConfig: {
        access: "public",
      },
    });
    writeFile(
      repo,
      "packages/public/CHANGELOG.md",
      "# @croco/public\n\n## 0.0.4\n\n### Patch Changes\n\n- Release public package behavior.\n",
    );
    writeFile(repo, "packages/public/src/index.ts", "export const value = 2;\n");
    git(repo, ["rm", ".changeset/public-version.md"]);
    git(repo, [
      "add",
      "packages/public/package.json",
      "packages/public/CHANGELOG.md",
      "packages/public/src/index.ts",
    ]);
    git(repo, ["commit", "-m", "fix: change source with version metadata"]);

    const result = runScript(repo);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("@croco/public");
    expect(result.stdout).toContain("packages/public/src/index.ts");
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
    dependencies: {
      "@croco/dependency": "^0.0.3",
    },
  });
  writePackage(repo, "dependency", {
    name: "@croco/dependency",
    version: "0.0.3",
    publishConfig: {
      access: "public",
    },
  });
  writePackage(repo, "other", {
    name: "@croco/other",
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
  writePackageJson(repo, packageDirName, pkg);
  writeFile(repo, `packages/${packageDirName}/src/index.ts`, "export const value = 1;\n");
}

function writePackageJson(
  repo: string,
  packageDirName: string,
  pkg: Record<string, unknown>,
): void {
  writeFile(repo, `packages/${packageDirName}/package.json`, `${JSON.stringify(pkg, null, 2)}\n`);
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

function writeCreateCrocoAppRanges(repo: string, ranges: Record<string, string>): void {
  const entries = Object.entries(ranges)
    .map(([packageName, range]) => `  "${packageName}": "${range}",`)
    .join("\n");

  writeFile(
    repo,
    "packages/create-croco-app/src/helpers/croco-ranges.ts",
    `const EXTERNAL_CROCO_PACKAGE_RANGES = {
${entries}
} as const satisfies Record<string, string>;

export function getExternalCrocoPackageRange(packageName: string): string | undefined {
  return EXTERNAL_CROCO_PACKAGE_RANGES[packageName as keyof typeof EXTERNAL_CROCO_PACKAGE_RANGES];
}
`,
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

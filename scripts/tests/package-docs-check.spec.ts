import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../package-docs-check.mts");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("package-docs-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("writes the README package catalog and documentation report from package manifests", () => {
    const root = createTempRoot();
    writePackage(root, "alpha", { name: "@croco/alpha" });
    writePackage(root, "beta", { name: "@croco/beta" });
    writeCatalogMetadata(root, ["alpha", "beta"]);
    writeDocsBaseline(root, {
      allowedMissingApiDocs: ["alpha", "beta"],
      allowedMissingReadme: [],
      allowedMissingTests: [],
    });

    const result = runScript(root, "--write");
    const readme = readFileSync(join(root, "README.md"), "utf-8");
    const report = readFileSync(join(root, "docs", "package-docs-report.md"), "utf-8");
    const matrix = readFileSync(
      join(
        root,
        "packages",
        "docs",
        "src",
        "content",
        "docs",
        "en",
        "reference",
        "extension-matrix.md",
      ),
      "utf-8",
    );

    expect(result.status).toBe(0);
    expect(readme).toContain("<!-- CROCO:PACKAGE-CATALOG:START -->");
    expect(readme).toContain("현재 카탈로그는 **2개 public package**");
    expect(readme).toContain("Extension & Adapter Matrix");
    expect(readme).toContain("`@croco/alpha`");
    expect(report).toContain("Missing generated API docs");
    expect(report).toContain("Extension Matrix");
    expect(matrix).toContain("title: Extension Matrix");
    expect(matrix).toContain("`@croco/alpha`");
  });

  it("fails check mode when the README catalog was not regenerated", () => {
    const root = createTempRoot();
    writePackage(root, "alpha", { name: "@croco/alpha" });
    writeCatalogMetadata(root, ["alpha"]);
    writeDocsBaseline(root, {
      allowedMissingApiDocs: ["alpha"],
      allowedMissingReadme: [],
      allowedMissingTests: [],
    });

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("README.md package catalog drift detected");
    expect(result.stdout).toContain("reference/extension-matrix.md drift detected");
    expect(result.stdout).toContain("docs/package-docs-report.md drift detected");
  });

  it("fails when metadata references a package that no longer exists", () => {
    const root = createTempRoot();
    writePackage(root, "alpha", { name: "@croco/alpha" });
    writeCatalogMetadata(root, ["alpha", "removed"]);
    writeDocsBaseline(root, {
      allowedMissingApiDocs: ["alpha"],
      allowedMissingReadme: [],
      allowedMissingTests: [],
    });

    const result = runScript(root, "--write");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("references missing package removed");
  });

  it("fails for a new public package without README or API docs outside the legacy baseline", () => {
    const root = createTempRoot();
    writePackage(root, "alpha", { name: "@croco/alpha" }, { readme: false });
    writeCatalogMetadata(root, ["alpha"]);
    writeDocsBaseline(root, {
      allowedMissingApiDocs: [],
      allowedMissingReadme: [],
      allowedMissingTests: [],
    });

    const result = runScript(root, "--write");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("new public packages missing README");
    expect(result.stdout).toContain("new public packages missing API docs");
  });

  it("fails when an extension group package is missing matrix metadata", () => {
    const root = createTempRoot();
    writePackage(root, "provider", { name: "@croco/provider" });
    writeCatalogMetadata(root, ["provider"], {
      extensionGroups: ["Provider"],
      extensionPackages: [],
      groupName: "Provider",
    });
    writeDocsBaseline(root, {
      allowedMissingApiDocs: ["provider"],
      allowedMissingReadme: [],
      allowedMissingTests: [],
    });

    const result = runScript(root, "--write");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "extensionMatrix is missing metadata for Provider package provider",
    );
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-package-docs-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"), { recursive: true });
  writeFileSync(
    join(root, "README.md"),
    [
      "# Fixture",
      "",
      "## 📦 패키지 카탈로그",
      "",
      "manual catalog",
      "",
      "---",
      "",
      "## 🛠 개발 환경",
      "",
      "dev section",
      "",
    ].join("\n"),
  );

  return root;
}

function writePackage(
  root: string,
  packageDirName: string,
  pkg: Record<string, unknown>,
  options: { readonly readme?: boolean; readonly tests?: boolean } = {},
): void {
  const packageDir = join(root, "packages", packageDirName);
  mkdirSync(packageDir, { recursive: true });
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFileSync(join(packageDir, "src", "index.ts"), "export const value = 1;\n");

  if (options.tests !== false) {
    mkdirSync(join(packageDir, "src", "tests"), { recursive: true });
  }

  if (options.readme !== false) {
    writeFileSync(join(packageDir, "README.md"), `# ${pkg.name}\n\nFixture package.\n`);
  }

  writeFileSync(join(packageDir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

function writeCatalogMetadata(
  root: string,
  packageNames: readonly string[],
  options: {
    readonly extensionGroups?: readonly string[];
    readonly extensionPackages?: readonly string[];
    readonly groupName?: string;
  } = {},
): void {
  const groupName = options.groupName ?? "Core";
  const extensionPackages = options.extensionPackages ?? packageNames;
  writeJson(join(root, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    groups: {
      [groupName]: {
        description: "Fixture core packages",
        packages: packageNames,
      },
    },
    maturity: {
      production: {
        label: "production-ready",
        packages: packageNames,
      },
      beta: {
        label: "beta",
        packages: [],
      },
      alpha: {
        label: "alpha",
        packages: [],
      },
      deprecated: {
        label: "deprecated",
        packages: [],
      },
    },
    extensionMatrix: {
      groups: options.extensionGroups ?? [groupName],
      packages: Object.fromEntries(
        extensionPackages.map((packageName) => [
          packageName,
          {
            adapter: "Fixture adapter",
            domain: "Fixture",
            features: ["Fixture feature"],
            requiredEnv: ["none"],
            runtimes: ["node"],
          },
        ]),
      ),
    },
  });
}

function writeDocsBaseline(
  root: string,
  baseline: {
    readonly allowedMissingApiDocs: readonly string[];
    readonly allowedMissingReadme: readonly string[];
    readonly allowedMissingTests: readonly string[];
  },
): void {
  writeJson(join(root, "docs", "package-docs-baseline.json"), {
    schemaVersion: 1,
    ...baseline,
  });
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

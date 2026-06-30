import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWorkspacePackageIndex,
  resolveLocalCrocoPackagesForGeneratedProject,
  rewriteExternalCrocoRanges,
  writePnpmWorkspaceOverrides,
} from "../create-croco-app-generated-smoke-support.mts";

const tempRoots: string[] = [];

describe("create-croco-app-generated-smoke dependency resolution", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("resolves template-only generated Croco dependencies from the workspace index", () => {
    const root = createTempRoot();
    const projectDir = join(root, "generated-app");
    writeWorkspacePackage(root, "template-only", "@croco/template-only", {
      "@croco/transitive-only": "workspace:*",
    });
    writeWorkspacePackage(root, "transitive-only", "@croco/transitive-only");
    writeGeneratedPackage(projectDir, "package.json", {
      name: "generated-app",
      dependencies: {
        "@croco/template-only": "^0.0.0",
      },
    });

    const workspacePackageIndex = createWorkspacePackageIndex(root);
    const workspacePackages = resolveLocalCrocoPackagesForGeneratedProject(
      projectDir,
      workspacePackageIndex,
    );

    expect(workspacePackages.map(({ name }) => name)).toEqual([
      "@croco/template-only",
      "@croco/transitive-only",
    ]);
  });

  it("fails when a generated manifest references an unhandled Croco dependency", () => {
    const root = createTempRoot();
    const projectDir = join(root, "generated-app");
    writeGeneratedPackage(projectDir, "package.json", {
      name: "generated-app",
      dependencies: {
        "@croco/missing-workspace": "^0.0.0",
      },
    });

    const workspacePackageIndex = createWorkspacePackageIndex(root);

    expect(() =>
      resolveLocalCrocoPackagesForGeneratedProject(projectDir, workspacePackageIndex),
    ).toThrow(
      "Generated project package.json references @croco/missing-workspace, but it is not a local @croco workspace package and has no explicit generated-smoke external exception",
    );
  });

  it("rewrites external Croco dependencies while preserving generated workspace package names", () => {
    const root = createTempRoot();
    const projectDir = join(root, "generated-app");
    writeGeneratedPackage(projectDir, "package.json", {
      name: "generated-app",
      dependencies: {
        "@croco/provider-rpc": "workspace:*",
        "@croco/template-only": "^0.0.0",
      },
    });
    writeGeneratedPackage(projectDir, "libs/provider-rpc/package.json", {
      name: "@croco/provider-rpc",
      version: "0.0.0",
    });

    rewriteExternalCrocoRanges(projectDir, {
      "@croco/template-only": "file:/tmp/template-only.tgz",
    });

    const packageJson = readGeneratedPackage(projectDir, "package.json");
    expect(packageJson.dependencies?.["@croco/template-only"]).toBe("file:/tmp/template-only.tgz");
    expect(packageJson.dependencies?.["@croco/provider-rpc"]).toBe("workspace:*");
  });

  it("allows published-range fallback only through explicit external exceptions", () => {
    const root = createTempRoot();
    const projectDir = join(root, "generated-app");
    const externalExceptions = {
      "@croco/external-only": {
        range: "^9.0.0",
        reason: "fixture package that intentionally has no local workspace package",
      },
    };
    writeGeneratedPackage(projectDir, "package.json", {
      name: "generated-app",
      dependencies: {
        "@croco/external-only": "workspace:*",
      },
    });

    const workspacePackageIndex = createWorkspacePackageIndex(root);
    const workspacePackages = resolveLocalCrocoPackagesForGeneratedProject(
      projectDir,
      workspacePackageIndex,
      externalExceptions,
    );
    rewriteExternalCrocoRanges(projectDir, {}, externalExceptions);

    const packageJson = readGeneratedPackage(projectDir, "package.json");
    expect(workspacePackages).toEqual([]);
    expect(packageJson.dependencies?.["@croco/external-only"]).toBe("^9.0.0");
  });

  it("writes local tarball overrides to pnpm-workspace.yaml", () => {
    const root = createTempRoot();
    const projectDir = join(root, "generated-app");
    writeGeneratedPackage(projectDir, "package.json", {
      name: "generated-app",
      dependencies: {
        "@croco/template-only": "^0.0.0",
      },
    });
    writeFileSync(
      join(projectDir, "pnpm-workspace.yaml"),
      ["packages:", '  - "apps/**/*"', "", "onlyBuiltDependencies:", "  - esbuild", ""].join("\n"),
    );

    writePnpmWorkspaceOverrides(projectDir, {
      "@croco/template-only": "file:/tmp/template-only.tgz",
    });

    const workspaceConfig = readFileSync(join(projectDir, "pnpm-workspace.yaml"), "utf8");
    const packageJson = readGeneratedPackage(projectDir, "package.json") as {
      readonly pnpm?: unknown;
    };

    expect(workspaceConfig).toContain('packages:\n  - "apps/**/*"');
    expect(workspaceConfig).toContain("onlyBuiltDependencies:\n  - esbuild");
    expect(workspaceConfig).toContain(
      'overrides:\n  "@croco/template-only": "file:/tmp/template-only.tgz"',
    );
    expect(packageJson.pnpm).toBeUndefined();
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-generated-smoke-test-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"), { recursive: true });

  return root;
}

function writeWorkspacePackage(
  root: string,
  packageDirName: string,
  packageName: string,
  dependencies: Record<string, string> = {},
): void {
  writeJson(join(root, "packages", packageDirName, "package.json"), {
    name: packageName,
    version: "0.0.0",
    dependencies,
  });
}

function writeGeneratedPackage(
  projectDir: string,
  relativePath: string,
  packageJson: Record<string, unknown>,
): void {
  writeJson(join(projectDir, relativePath), packageJson);
}

function readGeneratedPackage(
  projectDir: string,
  relativePath: string,
): {
  readonly dependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(projectDir, relativePath), "utf8")) as {
    readonly dependencies?: Record<string, string>;
  };
}

function writeJson(path: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

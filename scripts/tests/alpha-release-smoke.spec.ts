import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  alphaReleaseBinarySmokeCommands,
  alphaReleaseCleanInstallImportExclusions,
  alphaReleaseEvidenceReportPath,
  alphaReleaseCleanInstallImportPackages,
  alphaReleaseGeneratedAppSmoke,
  alphaReleaseGeneratedAppValidations,
  alphaReleaseSpineRoots,
  deriveAlphaReleaseCleanInstallImportPackages,
  formatAlphaReleaseSmokeReport,
  normalizeCatalogSpinePackageName,
  readCatalogSpinePackageNames,
  validateAlphaReleaseSpineCoverage,
  writePnpmOverrides,
} from "../alpha-release-smoke.mts";

const tempRoots: string[] = [];

describe("alpha-release-smoke.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("derives the alpha spine from the package catalog", () => {
    expect(alphaReleaseSpineRoots).toEqual(readCatalogSpinePackageNames());
    expect(alphaReleaseSpineRoots).toEqual([
      "@croco/framework-context",
      "@croco/problems-core",
      "@croco/protocols-core",
      "@croco/protocols-rest",
      "@croco/openapi-spec",
      "@croco/rpc-codegen",
      "@croco/transports-http",
      "@croco/telemetry-api",
      "@croco/telemetry-sdk-node",
      "@croco/tx-core",
      "@croco/tx-drizzle",
      "@croco/events-core",
      "@croco/events-tx",
      "@croco/retry-core",
      "@croco/idempotency-core",
      "@croco/testing",
      "create-croco-app",
      "@croco/cli",
    ]);
    expect(normalizeCatalogSpinePackageName("framework-context")).toBe("@croco/framework-context");
    expect(normalizeCatalogSpinePackageName("cli")).toBe("@croco/cli");
    expect(normalizeCatalogSpinePackageName("create-croco-app")).toBe("create-croco-app");
  });

  it("defines packed generated app validation path", () => {
    expect(alphaReleaseGeneratedAppSmoke).toMatchObject({
      name: "alpha-production-app",
      preset: "production-app",
    });
    expect(alphaReleaseGeneratedAppValidations).toEqual([
      "contract:snapshot",
      "contract:verify",
      "typecheck",
      "build",
      "test",
      "dev:smoke",
    ]);
    expect(alphaReleaseEvidenceReportPath).toBe("ci-reports/release/alpha-release-smoke.md");
  });

  it("covers every cataloged spine package with an import smoke or checked exclusion", () => {
    expect(alphaReleaseCleanInstallImportPackages).toEqual([
      "@croco/framework-context",
      "@croco/problems-core",
      "@croco/protocols-core",
      "@croco/protocols-rest",
      "@croco/openapi-spec",
      "@croco/rpc-codegen",
      "@croco/transports-http",
      "@croco/telemetry-api",
      "@croco/telemetry-sdk-node",
      "@croco/tx-core",
      "@croco/tx-drizzle",
      "@croco/events-core",
      "@croco/events-tx",
      "@croco/retry-core",
      "@croco/idempotency-core",
      "@croco/testing",
    ]);
    expect(alphaReleaseCleanInstallImportPackages).toEqual(
      deriveAlphaReleaseCleanInstallImportPackages(
        alphaReleaseSpineRoots,
        alphaReleaseCleanInstallImportExclusions,
      ),
    );
    expect(alphaReleaseCleanInstallImportExclusions).toEqual([
      expect.objectContaining({
        checkedBy:
          "pnpm exec create-croco-app <project> --preset production-app --scope @alpha --no-install --no-git",
        packageName: "create-croco-app",
      }),
      expect.objectContaining({
        checkedBy: "pnpm exec croco --help",
        packageName: "@croco/cli",
      }),
    ]);
    for (const exclusion of alphaReleaseCleanInstallImportExclusions) {
      expect(alphaReleaseBinarySmokeCommands).toContain(exclusion.checkedBy);
    }
    expect(
      validateAlphaReleaseSpineCoverage({
        cleanInstallImportExclusions: alphaReleaseCleanInstallImportExclusions,
        cleanInstallImports: alphaReleaseCleanInstallImportPackages,
        spineRoots: alphaReleaseSpineRoots,
      }),
    ).toEqual([]);
  });

  it("fails validation when a cataloged spine package has no smoke evidence", () => {
    expect(
      validateAlphaReleaseSpineCoverage({
        cleanInstallImportExclusions: [
          {
            checkedBy: "pnpm exec create-croco-app --version",
            packageName: "create-croco-app",
            reason: "binary package",
          },
        ],
        cleanInstallImports: ["@croco/framework-context"],
        spineRoots: ["@croco/framework-context", "@croco/new-spine", "create-croco-app"],
      }),
    ).toContain(
      "@croco/new-spine: cataloged spine package is neither import-smoked nor covered by a checked exclusion",
    );
  });

  it("fails validation when an exclusion is not tied to an alpha binary smoke command", () => {
    expect(
      validateAlphaReleaseSpineCoverage({
        cleanInstallImportExclusions: [
          {
            checkedBy: "manual checklist",
            packageName: "create-croco-app",
            reason: "binary package",
          },
        ],
        cleanInstallImports: ["@croco/framework-context"],
        spineRoots: ["@croco/framework-context", "create-croco-app"],
      }),
    ).toContain(
      "create-croco-app: clean-install import exclusion checkedBy is not an alpha-release binary smoke command",
    );
  });

  it("writes packed tarball overrides to pnpm-workspace.yaml", () => {
    const root = createTempRoot();
    writeJson(join(root, "package.json"), {
      name: "alpha-smoke-consumer",
      private: true,
      type: "module",
    });
    writeFileSync(
      join(root, "pnpm-workspace.yaml"),
      ["packages:", '  - "."', "", "onlyBuiltDependencies:", "  - esbuild", ""].join("\n"),
    );

    writePnpmOverrides(root, {
      "@croco/cli": "file:/tmp/croco-cli-0.0.4.tgz",
      "@croco/framework-context": "file:/tmp/croco-framework-context-0.0.4.tgz",
    });

    const workspaceConfig = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      readonly pnpm?: unknown;
    };

    expect(workspaceConfig).toContain('packages:\n  - "."');
    expect(workspaceConfig).toContain("onlyBuiltDependencies:\n  - esbuild");
    expect(workspaceConfig).toContain(
      [
        "overrides:",
        '  "@croco/cli": "file:/tmp/croco-cli-0.0.4.tgz"',
        '  "@croco/framework-context": "file:/tmp/croco-framework-context-0.0.4.tgz"',
      ].join("\n"),
    );
    expect(packageJson.pnpm).toBeUndefined();
  });

  it("formats release evidence with clean install and generated app claims", () => {
    const report = formatAlphaReleaseSmokeReport({
      cleanInstallImportExclusions: alphaReleaseCleanInstallImportExclusions,
      cleanInstallDirectory: "/tmp/spine",
      cleanInstallImports: alphaReleaseCleanInstallImportPackages,
      generatedAppDirectory: "/tmp/app",
      packedPackageCount: 12,
      smokeCase: alphaReleaseGeneratedAppSmoke,
      spineRoots: alphaReleaseSpineRoots,
      status: "PASS",
      validations: alphaReleaseGeneratedAppValidations,
    });

    expect(report).toContain("- Status: PASS");
    expect(report).toContain("`create-croco-app`");
    expect(report).toContain("- Clean install imports:");
    expect(report).toContain("- Clean install import exclusions:");
    expect(report).toContain("`pnpm exec croco --help`");
    expect(report).toContain("`pnpm contract:verify`");
    expect(report).toContain("`pnpm test`");
    expect(report).toContain("clean project from packed artifacts");
    expect(report).toContain("Generated app install uses packed Croco artifacts");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-alpha-release-smoke-test-"));
  tempRoots.push(root);
  mkdirSync(root, { recursive: true });

  return root;
}

function writeJson(path: string, value: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

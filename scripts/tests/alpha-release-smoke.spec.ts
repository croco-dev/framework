import { describe, expect, it } from "vitest";
import {
  alphaReleaseEvidenceReportPath,
  alphaReleaseCleanInstallImportPackages,
  alphaReleaseGeneratedAppSmoke,
  alphaReleaseGeneratedAppValidations,
  alphaReleaseSpineRoots,
  formatAlphaReleaseSmokeReport,
} from "../alpha-release-smoke.mts";

describe("alpha-release-smoke.mts", () => {
  it("defines the alpha spine and packed generated app validation path", () => {
    expect(alphaReleaseSpineRoots).toEqual([
      "create-croco-app",
      "@croco/cli",
      "@croco/events-core",
      "@croco/events-inmemory",
      "@croco/framework-context",
      "@croco/problems-core",
      "@croco/protocols-rest",
      "@croco/repository-core",
      "@croco/retry-core",
      "@croco/telemetry-api",
      "@croco/telemetry-sdk-node",
      "@croco/transports-http",
    ]);
    expect(alphaReleaseGeneratedAppSmoke).toMatchObject({
      name: "alpha-production-app",
      preset: "production-app",
    });
    expect(alphaReleaseGeneratedAppValidations).toEqual([
      "contract:snapshot",
      "contract:verify",
      "typecheck",
      "build",
      "dev:smoke",
    ]);
    expect(alphaReleaseCleanInstallImportPackages).toEqual([
      "@croco/diagnostics-core",
      "@croco/events-core",
      "@croco/framework-context",
      "@croco/problems-core",
      "@croco/protocols-core",
      "@croco/protocols-rest",
      "@croco/repository-core",
      "@croco/retry-core",
      "@croco/telemetry-api",
    ]);
    expect(alphaReleaseEvidenceReportPath).toBe("ci-reports/release/alpha-release-smoke.md");
  });

  it("formats release evidence with clean install and generated app claims", () => {
    const report = formatAlphaReleaseSmokeReport({
      cleanInstallDirectory: "/tmp/spine",
      generatedAppDirectory: "/tmp/app",
      packedPackageCount: 12,
      smokeCase: alphaReleaseGeneratedAppSmoke,
      spineRoots: alphaReleaseSpineRoots,
      status: "PASS",
      validations: alphaReleaseGeneratedAppValidations,
    });

    expect(report).toContain("- Status: PASS");
    expect(report).toContain("`create-croco-app`");
    expect(report).toContain("`pnpm contract:verify`");
    expect(report).toContain("clean project from packed artifacts");
    expect(report).toContain("Generated app install uses packed Croco artifacts");
  });
});

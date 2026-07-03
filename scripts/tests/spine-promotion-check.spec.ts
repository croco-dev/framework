import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildSpinePromotionMarkdown,
  createSpinePromotionReport,
  hasSpinePromotionFailures,
  parseArgs,
  writeSpinePromotionReport,
} from "../spine-promotion-check.mts";

const tempRepos: string[] = [];

describe("spine-promotion-check.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("passes when beta spine packages have promotion accountability", () => {
    const repo = createTempRepo();
    writePackage(repo, "protocols-core");
    writeCatalogMetadata(repo, {
      betaPackages: ["protocols-core"],
      promotionPackages: {
        "protocols-core": {
          owner: "protocol-contracts",
          targetEvidence: ["route contract graph fixtures"],
          recoveryAction: "Promote after strict contract diagnostics evidence is complete.",
        },
      },
      spinePackages: ["protocols-core"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(false);
    expect(markdown).toContain("| `@croco/protocols-core` | Core | `packages/protocols-core`");
    expect(markdown).toContain("protocol-contracts");
    expect(markdown).toContain("route contract graph fixtures");
    expect(markdown).toContain("Promote after strict contract diagnostics evidence is complete.");
  });

  it("fails when a beta spine package lacks promotion metadata", () => {
    const repo = createTempRepo();
    writePackage(repo, "openapi-spec");
    writeCatalogMetadata(repo, {
      betaPackages: ["openapi-spec"],
      spinePackages: ["openapi-spec"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(true);
    expect(markdown).toContain("unaccounted: missing owner, targetEvidence, recoveryAction");
  });

  it("fails when promotion metadata has empty required fields", () => {
    const repo = createTempRepo();
    writePackage(repo, "rpc-codegen");
    writeCatalogMetadata(repo, {
      betaPackages: ["rpc-codegen"],
      promotionPackages: {
        "rpc-codegen": {
          owner: " ",
          targetEvidence: [" "],
          recoveryAction: "",
        },
      },
      spinePackages: ["rpc-codegen"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(true);
    expect(markdown).toContain("unaccounted: missing owner, targetEvidence, recoveryAction");
  });

  it("does not fail for unrelated non-spine beta packages", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writePackage(repo, "non-spine-beta");
    writeCatalogMetadata(repo, {
      betaPackages: ["non-spine-beta"],
      productionPackages: ["stable"],
      spinePackages: ["stable"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(false);
    expect(report.ignoredNonSpineNonProductionCount).toBe(1);
    expect(markdown).toContain("Beta spine packages: 0");
  });

  it("fails when an alpha package is added to the release spine", () => {
    const repo = createTempRepo();
    writePackage(repo, "experimental-spine");
    writeCatalogMetadata(repo, {
      alphaPackages: ["experimental-spine"],
      spinePackages: ["experimental-spine"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(true);
    expect(report.catalogErrors).toContain(
      "docs/package-catalog.json: spine package experimental-spine is alpha; move it to maturity.beta.packages with spine.promotion.packages.experimental-spine metadata before 1.0 promotion, or remove it from spine.packages",
    );
    expect(markdown).toContain("spine package experimental-spine is alpha");
  });

  it("warns without failing for stale promotion metadata outside the beta spine", () => {
    const repo = createTempRepo();
    writePackage(repo, "stable");
    writeCatalogMetadata(repo, {
      productionPackages: ["stable"],
      promotionPackages: {
        stable: {
          owner: "release",
          targetEvidence: ["already production-ready"],
          recoveryAction: "Remove stale promotion metadata.",
        },
      },
      spinePackages: ["stable"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(false);
    expect(report.catalogWarnings).toEqual([
      "docs/package-catalog.json: spine.promotion.packages.stable is outside the current beta spine and should be removed when promotion is complete or out of scope",
    ]);
    expect(markdown).toContain(
      "spine.promotion.packages.stable is outside the current beta spine and should be removed when promotion is complete or out of scope",
    );
  });

  it("accounts for unscoped create-croco-app beta spine metadata", () => {
    const repo = createTempRepo();
    writePackage(repo, "create-croco-app", { packageName: "create-croco-app" });
    writeCatalogMetadata(repo, {
      betaPackages: ["create-croco-app"],
      groupName: "Tooling",
      promotionPackages: {
        "create-croco-app": {
          owner: "generated-app-tooling",
          targetEvidence: ["generated app smoke matrix"],
          recoveryAction: "Promote after clean install provenance is complete.",
        },
      },
      spinePackages: ["create-croco-app"],
    });

    const report = createReport(repo);
    const markdown = buildSpinePromotionMarkdown(report);

    expect(hasSpinePromotionFailures(report)).toBe(false);
    expect(markdown).toContain("| `create-croco-app` | Tooling | `packages/create-croco-app`");
    expect(markdown).toContain("generated-app-tooling");
  });

  it("accepts the pnpm CLI separator before options", () => {
    const repo = createTempRepo();

    const options = parseArgs(["--", "--root", repo, "--output-dir", "reports"]);

    expect(options.rootDir).toBe(repo);
    expect(options.outputDir).toBe(join(repo, "reports"));
  });

  it("writes the spine promotion markdown report artifact", () => {
    const repo = createTempRepo();
    writePackage(repo, "testing");
    writeCatalogMetadata(repo, {
      betaPackages: ["testing"],
      promotionPackages: {
        testing: {
          owner: "release-tooling",
          targetEvidence: ["test harness API docs"],
          recoveryAction: "Promote after conformance utility coverage is complete.",
        },
      },
      spinePackages: ["testing"],
    });

    const report = createReport(repo);
    const markdownPath = writeSpinePromotionReport(
      report,
      join(repo, "ci-reports", "package-quality"),
    );
    const markdown = readFileSync(markdownPath, "utf-8");

    expect(markdownPath).toBe(join(repo, "ci-reports", "package-quality", "spine-promotion.md"));
    expect(markdown).toContain("# Beta Spine Promotion Gate");
  });
});

function createReport(repo: string) {
  return createSpinePromotionReport({
    generatedAt: "2026-01-01T00:00:00.000Z",
    rootDir: repo,
  });
}

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-spine-promotion-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  return repo;
}

function writePackage(
  repo: string,
  dirName: string,
  options: { readonly packageName?: string } = {},
): void {
  const packageDir = join(repo, "packages", dirName);
  mkdirSync(packageDir, { recursive: true });
  writeJson(join(packageDir, "package.json"), {
    name: options.packageName ?? `@croco/${dirName}`,
    scripts: {
      build: "tsup",
      test: "vitest run",
      typecheck: "tsc --noEmit",
    },
  });
}

function writeCatalogMetadata(
  repo: string,
  options: {
    readonly alphaPackages?: readonly string[];
    readonly betaPackages?: readonly string[];
    readonly groupName?: string;
    readonly productionPackages?: readonly string[];
    readonly promotionPackages?: Record<
      string,
      {
        readonly owner: string;
        readonly targetEvidence: readonly string[];
        readonly recoveryAction: string;
      }
    >;
    readonly spinePackages?: readonly string[];
  },
): void {
  const alphaPackages = options.alphaPackages ?? [];
  const groupName = options.groupName ?? "Core";
  const betaPackages = options.betaPackages ?? [];
  const productionPackages = options.productionPackages ?? [];
  const spinePackages = options.spinePackages ?? [];
  const allPackageNames = [
    ...new Set([...spinePackages, ...productionPackages, ...betaPackages, ...alphaPackages]),
  ];
  const spine =
    options.promotionPackages === undefined
      ? {
          label: "Croco 1.0 spine",
          description: "Fixture spine",
          packages: spinePackages,
        }
      : {
          label: "Croco 1.0 spine",
          description: "Fixture spine",
          packages: spinePackages,
          promotion: {
            packages: options.promotionPackages,
          },
        };

  writeJson(join(repo, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    spine,
    groups: {
      [groupName]: {
        description: "Fixture packages",
        packages: allPackageNames,
      },
    },
    maturity: {
      production: {
        label: "production-ready",
        packages: productionPackages,
      },
      beta: {
        label: "beta",
        packages: betaPackages,
      },
      alpha: {
        label: "alpha",
        packages: alphaPackages,
      },
      deprecated: {
        label: "deprecated",
        packages: [],
      },
    },
  });
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildProviderCertificationMarkdown,
  createProviderCertificationReport,
  hasProviderCertificationFailures,
  parseArgs,
  writeProviderCertificationReport,
} from "../provider-certification-check.mts";

const tempRepos: string[] = [];

describe("provider-certification-check.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("passes for a production-ready extension package with certified package-scoped evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider"),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(false);
    expect(markdown).toContain(
      "| `@croco/provider` | Provider | production | certified-required | certified |",
    );
  });

  it("fails when a production-ready extension package has no certification record", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("has no certification.records.provider entry");
  });

  it("requires certification for production packages explicitly listed in the extension matrix", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      extensionGroups: ["Provider"],
      extensionPackages: ["provider"],
      groupName: "Core",
      productionPackages: ["provider"],
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain(
      "| `@croco/provider` | Core | production | certified-required | missing |",
    );
    expect(markdown).toContain("has no certification.records.provider entry");
  });

  it("marks beta extension packages without certification records as not applicable", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: [],
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(false);
    expect(markdown).toContain(
      "| `@croco/provider` | Provider | beta | not-applicable | missing |",
    );
    expect(markdown).toContain(
      "not-applicable by catalog policy until the extension package claims certification or enters the required maturity",
    );
  });

  it("marks beta certification records as optional candidates until promotion or public claim", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: [],
      certificationRecords: {
        provider: createCertifiedRecord("provider", { state: "candidate" }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(false);
    expect(markdown).toContain(
      "| `@croco/provider` | Provider | beta | candidate-optional | candidate |",
    );
  });

  it("fails candidate records with missing live smoke evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: [],
      certificationRecords: {
        provider: createCertifiedRecord("provider", {
          evidence: {
            liveSmoke: {
              status: "missing",
              reason: "Real credential live smoke has not been recorded.",
            },
          },
          knownGaps: ["liveSmoke evidence has not been recorded."],
          state: "candidate",
        }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("evidence.liveSmoke status is missing");
    expect(markdown).toContain("blocking known gaps without package-scoped allowance");
  });

  it("requires production-ready extension packages to use certified state", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider", { state: "candidate" }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("certification state is candidate");
  });

  it("fails certified records with missing required evidence", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider", {
          omitEvidence: "redaction",
        }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("redaction: fail");
  });

  it("validates certified records outside the extension matrix", () => {
    const repo = createTempRepo();
    writePackage(repo, "core");
    writeCatalogMetadata(repo, ["core"], {
      extensionGroups: [],
      extensionPackages: [],
      productionPackages: [],
      certificationRecords: {
        core: createCertifiedRecord("core", {
          knownGaps: ["release-evidence-gap"],
          omitEvidence: "diagnostics",
        }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain(
      "| `@croco/core` | Provider | beta | certified-required | certified |",
    );
    expect(markdown).toContain("diagnostics: fail");
    expect(markdown).toContain(
      "blocking known gaps without package-scoped allowance: release-evidence-gap",
    );
  });

  it("rejects build-only command evidence for certified packages", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider", {
          command: "pnpm --filter @croco/provider build",
        }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("does not run a test or smoke command");
  });

  it("rejects command evidence paths that are not test or smoke artifacts", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider", {
          evidencePath: "packages/provider/README.md",
        }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("packages/provider/README.md is not a test or smoke evidence file");
  });

  it("blocks known gaps for certified production-ready packages without package-scoped allowances", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider", {
          knownGaps: ["live-smoke-recording"],
        }),
      },
    });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain("blocking known gaps without package-scoped allowance");
  });

  it("allows known gaps only with package-scoped reason and owner", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider", {
          knownGaps: ["live-smoke-recording"],
        }),
      },
      knownGapAllowances: {
        provider: {
          "live-smoke-recording": {
            owner: "@croco/release",
            reason: "The live smoke is env-gated and tracked by the release evidence issue.",
          },
        },
      },
    });

    const report = createReport(repo);

    expect(hasProviderCertificationFailures(report)).toBe(false);
  });

  it("fails unfenced manual Croco compatible claims without a certified record", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "provider",
      [
        "# @croco/provider",
        "",
        "```md",
        "Croco compatible: example only",
        "```",
        "",
        "![Croco compatible: Provider contract](badge.svg)",
      ].join("\n"),
    );
    writeCatalogMetadata(repo, ["provider"], { productionPackages: [] });

    const report = createReport(repo);

    expect(report.claimViolations).toHaveLength(1);
    expect(report.claimViolations[0]?.file).toBe("packages/provider/README.md");
    expect(hasProviderCertificationFailures(report)).toBe(true);
  });

  it("treats public compatibility claims as certified-required policy scope", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "provider",
      ["# @croco/provider", "", "Croco compatible: @croco/provider provider contract"].join("\n"),
    );
    writeCatalogMetadata(repo, ["provider"], { productionPackages: [] });

    const report = createReport(repo);
    const markdown = buildProviderCertificationMarkdown(report);

    expect(hasProviderCertificationFailures(report)).toBe(true);
    expect(markdown).toContain(
      "| `@croco/provider` | Provider | beta | certified-required | missing |",
    );
    expect(markdown).toContain(
      "requires certified compatibility evidence and has no certification.records.provider entry",
    );
  });

  it("fails when the certification policy scope is missing", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      certificationPolicy: null,
      productionPackages: [],
    });

    const report = createReport(repo);

    expect(report.catalogErrors).toContain(
      "docs/package-catalog.json: certification.policy must define certification scope",
    );
    expect(hasProviderCertificationFailures(report)).toBe(true);
  });

  it("fails when the certification policy references a malformed scope group", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      certificationPolicy: {
        scope: createCertificationPolicyScope(["Integration"]),
      },
      productionPackages: [],
    });

    const report = createReport(repo);

    expect(report.catalogErrors).toContain(
      "docs/package-catalog.json: certification.policy.scope.extensionGroups references non-extension group Integration",
    );
    expect(report.catalogErrors).toContain(
      "docs/package-catalog.json: certification.policy.scope.extensionGroups must include extensionMatrix group Provider",
    );
    expect(hasProviderCertificationFailures(report)).toBe(true);
  });

  it("fails when certification policy state descriptions are blank", () => {
    const repo = createTempRepo();
    const policyScope = createCertificationPolicyScope(["Provider"]);
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      certificationPolicy: {
        scope: {
          ...policyScope,
          states: {
            ...(policyScope.states as Record<string, unknown>),
            "candidate-optional": "  ",
          },
        },
      },
      productionPackages: [],
    });

    const report = createReport(repo);

    expect(report.catalogErrors).toContain(
      "docs/package-catalog.json: certification.policy.scope.states.candidate-optional must be a non-empty string",
    );
    expect(hasProviderCertificationFailures(report)).toBe(true);
  });

  it("fails badge and prose certification claims without a certified catalog record", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "provider",
      [
        "# @croco/provider",
        "",
        "![Certified provider](badge.svg)",
        "",
        "This package is certified for the Croco provider contract.",
      ].join("\n"),
    );
    writeCatalogMetadata(repo, ["provider"], { productionPackages: [] });

    const report = createReport(repo);

    expect(report.claimViolations.map((violation) => violation.line)).toEqual([3, 5]);
    expect(hasProviderCertificationFailures(report)).toBe(true);
  });

  it("fails docs certification claims for named packages unless the catalog record is certified", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeFile(
      repo,
      "docs/provider.md",
      "# Provider\n\nCroco compatible: @croco/provider provider contract\n",
    );
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: [],
      certificationRecords: {
        provider: createCertifiedRecord("provider", { state: "candidate" }),
      },
    });

    const report = createReport(repo);

    expect(report.claimViolations).toHaveLength(1);
    expect(report.claimViolations[0]?.file).toBe("docs/provider.md");
    expect(hasProviderCertificationFailures(report)).toBe(true);
  });

  it("writes provider certification markdown and JSON artifacts", () => {
    const repo = createTempRepo();
    writePackage(repo, "provider");
    writeCatalogMetadata(repo, ["provider"], {
      productionPackages: ["provider"],
      certificationRecords: {
        provider: createCertifiedRecord("provider"),
      },
    });

    const report = createReport(repo);
    const paths = writeProviderCertificationReport(
      report,
      join(repo, "ci-reports", "package-quality"),
    );
    const markdown = readFileSync(paths.markdownPath, "utf-8");
    const json = readFileSync(paths.jsonPath, "utf-8");

    expect(paths.markdownPath).toBe(
      join(repo, "ci-reports", "package-quality", "provider-certification.md"),
    );
    expect(paths.jsonPath).toBe(
      join(repo, "ci-reports", "package-quality", "provider-certification.json"),
    );
    expect(markdown).toContain("# Provider Certification Gate");
    expect(json).toContain('"productionExtensionPackageCount": 1');
  });

  it("accepts the pnpm CLI separator before options", () => {
    const repo = createTempRepo();

    const options = parseArgs(["--", "--root", repo]);

    expect(options.rootDir).toBe(repo);
  });
});

function createReport(repo: string) {
  return createProviderCertificationReport({
    generatedAt: "2026-01-01T00:00:00.000Z",
    outputDir: join(repo, "ci-reports", "package-quality"),
    rootDir: repo,
  });
}

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-provider-certification-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  writeFile(repo, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  return repo;
}

function writePackage(repo: string, dirName: string, readme?: string): void {
  const packageDir = join(repo, "packages", dirName);
  mkdirSync(join(packageDir, "src", "tests"), { recursive: true });
  writeFile(
    repo,
    `packages/${dirName}/README.md`,
    readme ??
      `# @croco/${dirName}\n\nOptional env-gated live smoke skips when credentials are absent.\n`,
  );
  writeFile(repo, `packages/${dirName}/src/tests/${toPascalCase(dirName)}.spec.ts`, "export {};\n");
  writeJson(join(packageDir, "package.json"), {
    name: `@croco/${dirName}`,
    scripts: {
      build: "tsup",
      test: "vitest run",
      typecheck: "tsc --noEmit",
    },
  });
}

function writeCatalogMetadata(
  repo: string,
  packageNames: readonly string[],
  options: {
    readonly certificationPolicy?: Record<string, unknown> | null;
    readonly certificationRecords?: Record<string, Record<string, unknown>>;
    readonly extensionGroups?: readonly string[];
    readonly extensionPackages?: readonly string[];
    readonly groupName?: string;
    readonly knownGapAllowances?: Record<string, Record<string, unknown>>;
    readonly productionPackages: readonly string[];
  },
): void {
  const productionSet = new Set(options.productionPackages);
  const groupName = options.groupName ?? "Provider";
  const extensionGroups = options.extensionGroups ?? ["Provider"];
  const extensionPackages = options.extensionPackages ?? packageNames;

  writeJson(join(repo, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    groups: {
      [groupName]: {
        description: "Fixture provider packages",
        packages: packageNames,
      },
    },
    maturity: {
      production: {
        label: "production-ready",
        packages: options.productionPackages,
      },
      beta: {
        label: "beta",
        packages: packageNames.filter((packageName) => !productionSet.has(packageName)),
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
      groups: extensionGroups,
      packages: Object.fromEntries(
        extensionPackages.map((packageName) => [
          packageName,
          {
            domain: "Fixture",
            adapter: "Fixture provider",
            runtimes: ["node", "lambda"],
            requiredEnv: ["none"],
            features: ["fixture"],
          },
        ]),
      ),
    },
    certification:
      options.certificationPolicy === null
        ? {
            schemaVersion: 1,
            records: Object.values(options.certificationRecords ?? {}),
          }
        : {
            schemaVersion: 1,
            policy: {
              scope: createCertificationPolicyScope(extensionGroups),
              knownGapAllowances: options.knownGapAllowances ?? {},
              ...options.certificationPolicy,
            },
            records: Object.values(options.certificationRecords ?? {}),
          },
  });
}

function createCertificationPolicyScope(
  extensionGroups: readonly string[],
): Record<string, unknown> {
  return {
    extensionGroups,
    requiredMaturity: "production",
    claimRequiresCertified: true,
    states: {
      "certified-required":
        "A certified record is required for production-ready extension packages or public compatibility claims.",
      "candidate-optional":
        "A pre-production record may track evidence before the extension package is production-ready; candidate state requires liveSmoke evidence.",
      "not-applicable":
        "No certification record is required until production-ready maturity or a public compatibility claim.",
    },
  };
}

function createCertifiedRecord(
  packageName: string,
  options: {
    readonly command?: string;
    readonly evidence?: Record<string, Record<string, unknown>>;
    readonly evidencePath?: string;
    readonly knownGaps?: readonly string[];
    readonly omitEvidence?: string;
    readonly state?: string;
  } = {},
): Record<string, unknown> {
  const command = options.command ?? `pnpm --filter @croco/${packageName} test`;
  const evidencePath =
    options.evidencePath ??
    `packages/${packageName}/src/tests/${toPascalCase(packageName)}.spec.ts`;
  const evidence: Record<string, unknown> = {
    conformance: { status: "present", command, artifact: evidencePath },
    noCredentialSmoke: { status: "present", command, artifact: evidencePath },
    diagnostics: { status: "present", command, artifact: evidencePath },
    redactionTests: { status: "present", command, artifact: evidencePath },
    liveSmoke: {
      status: "present",
      artifact: `packages/${packageName}/README.md`,
      description: "Optional env-gated live smoke skips when credentials are absent.",
    },
    ...options.evidence,
  };

  if (options.omitEvidence) {
    delete evidence[options.omitEvidence === "redaction" ? "redactionTests" : options.omitEvidence];
  }

  return {
    package: `@croco/${packageName}`,
    state: options.state ?? "certified",
    contract: "FixtureProvider",
    adapterCategory: "provider",
    packageVersion: "0.0.0",
    runtimes: ["node", "lambda"],
    evidence,
    knownGaps: options.knownGaps ?? [],
  };
}

function toPascalCase(value: string): string {
  return value
    .split("-")
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join("");
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

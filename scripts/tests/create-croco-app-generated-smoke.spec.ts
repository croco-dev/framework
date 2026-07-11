import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertGeneratedPresentationProfileMatchesCatalog,
  readCommandOutputSegment,
  readGeneratedSmokeAllowlistMetadata,
} from "../create-croco-app-generated-smoke.mts";
import {
  classifySmokeCommandFailure,
  classifySmokeFailure,
  collectSmokeFailureArtifactFiles,
  copyGeneratedSmokeArtifacts,
  createSmokeRecoverySummary,
  extractSmokeCommandDiagnosticCodes,
  renderGeneratedSmokeArtifacts,
  shouldIncludeSmokeFailureArtifact,
  shouldSkipSmokeArtifactDirectory,
} from "../create-croco-app-generated-smoke-report.mts";
import {
  assertGeneratedSmokeJourneyReport,
  createGeneratedSmokeJourneyReport,
  GENERATED_SMOKE_JOURNEY_DEFINITIONS,
  isCanonicalGeneratedSmokeJourneySelection,
  renderGeneratedSmokeJourneyReport,
  writeCanonicalGeneratedSmokeJourneyBundle,
  writeGeneratedSmokeJourneyBundle,
  type GeneratedSmokeJourneySourceReport,
} from "../create-croco-app-generated-smoke-journey-report.mts";
import {
  assertGeneratedSmokeMatrixContract,
  createGeneratedSmokeMatrixAggregateReport,
  createGeneratedSmokeMatrixTierReport,
  GENERATED_SMOKE_MATRIX_CASES,
  renderGeneratedSmokeMatrixReport,
  selectGeneratedSmokeMatrixCases,
  type SmokeMatrixCaseDefinition,
} from "../create-croco-app-generated-smoke-matrix.mts";
import {
  createWorkspacePackageIndex,
  resolveLocalCrocoPackagesForGeneratedProject,
  rewriteExternalCrocoRanges,
  writePnpmWorkspaceOverrides,
} from "../create-croco-app-generated-smoke-support.mts";

const tempRoots: string[] = [];
const journeySourceCaseNames = [
  "production-app-starter",
  "graphql-lambda-api",
  "rest-spa-contracts",
] as const;

describe("create-croco-app generated smoke journey report", () => {
  it("projects the seven stable user journeys from exact executed smoke steps", () => {
    const report = createGeneratedSmokeJourneyReport(
      createJourneySourceReport(),
      journeySourceCaseNames,
    );

    expect(report.schemaVersion).toBe("croco.generated-app-smoke-journeys/v1");
    expect(report.status).toBe("passed");
    expect(report.journeys.map(({ id }) => id)).toEqual(
      GENERATED_SMOKE_JOURNEY_DEFINITIONS.map(({ id }) => id),
    );
    expect(report.journeys.find(({ id }) => id === "create-app")).toMatchObject({
      status: "passed",
      sourceSelectors: [
        {
          caseName: "production-app-starter",
          stepLabels: ["generate", "install"],
        },
      ],
      commands: ["node create-croco-app production-app-starter", "pnpm install"],
      artifacts: ["evidence/create-app.json"],
      recoveryAction: "pnpm create-croco-app:smoke production-app-starter",
    });
    expect(report.journeys.find(({ id }) => id === "validate-contracts")?.sourceArtifacts).toEqual([
      "artifacts/production-app-starter/contract-graph.snapshot.json",
    ]);
    expect(report.journeys.find(({ id }) => id === "validate-contracts")?.artifacts).toContain(
      "proof/artifacts/production-app-starter/contract-graph.snapshot.json",
    );
    expect(report.journeys.find(({ id }) => id === "handle-expected-failures")).toMatchObject({
      status: "passed",
      diagnosticCodes: ["contract-route-missing-problem-response-contract"],
    });
  });

  it("accepts v1 and rejects malformed journey report schemas", () => {
    const report = createGeneratedSmokeJourneyReport(
      createJourneySourceReport(),
      journeySourceCaseNames,
    );
    assertGeneratedSmokeJourneyReport(report);
    const candidate = () =>
      structuredClone(report) as unknown as {
        schemaVersion: string;
        status: string;
        journeys: Array<{
          id: string;
          title?: string;
          status: string;
          recoveryAction: string;
          sourceSelectors: Array<{
            caseName: string;
            stepLabels: string[];
          }>;
        }>;
      };

    const unknownVersion = candidate();
    unknownVersion.schemaVersion = "croco.generated-app-smoke-journeys/v2";
    expect(() => assertGeneratedSmokeJourneyReport(unknownVersion)).toThrow("Unknown");

    const duplicateId = candidate();
    const duplicateJourney = duplicateId.journeys[1];
    if (!duplicateJourney) {
      throw new Error("missing duplicate journey fixture");
    }
    duplicateJourney.id = "create-app";
    expect(() => assertGeneratedSmokeJourneyReport(duplicateId)).toThrow("duplicate journey ID");

    const missingField = candidate();
    const missingFieldJourney = missingField.journeys[0];
    if (!missingFieldJourney) {
      throw new Error("missing required-field journey fixture");
    }
    delete missingFieldJourney.title;
    expect(() => assertGeneratedSmokeJourneyReport(missingField)).toThrow("title");

    const blankRecovery = candidate();
    const blankRecoveryJourney = blankRecovery.journeys[0];
    if (!blankRecoveryJourney) {
      throw new Error("missing recovery journey fixture");
    }
    blankRecoveryJourney.recoveryAction = "  ";
    expect(() => assertGeneratedSmokeJourneyReport(blankRecovery)).toThrow("recoveryAction");

    const unknownStatus = candidate();
    const unknownStatusJourney = unknownStatus.journeys[0];
    if (!unknownStatusJourney) {
      throw new Error("missing status journey fixture");
    }
    unknownStatusJourney.status = "skipped";
    expect(() => assertGeneratedSmokeJourneyReport(unknownStatus)).toThrow("unknown status");

    const changedSelector = candidate();
    const changedSelectorJourney = changedSelector.journeys[0];
    if (!changedSelectorJourney) {
      throw new Error("missing selector journey fixture");
    }
    changedSelectorJourney.sourceSelectors[0] = {
      caseName: "rest-spa-contracts",
      stepLabels: ["generate", "install"],
    };
    expect(() => assertGeneratedSmokeJourneyReport(changedSelector)).toThrow(
      "sourceSelectors do not match the canonical journey definition",
    );
  });

  it("does not report create-app as passed when dependency installation fails", () => {
    const source = createJourneySourceReport();
    const productionCase = source.cases[0];
    if (!productionCase) {
      throw new Error("missing production-app-starter fixture");
    }
    const report = createGeneratedSmokeJourneyReport(
      {
        ...source,
        status: "failed",
        cases: [
          {
            ...productionCase,
            status: "failed",
            error: "install failed",
            artifactBundle: {
              stdoutPath: "ci-reports/generated-apps/cases/production-app-starter/stdout.log",
              stderrPath: "ci-reports/generated-apps/cases/production-app-starter/stderr.log",
              files: ["ci-reports/generated-apps/cases/production-app-starter/files/package.json"],
            },
            steps: productionCase.steps.map((step) =>
              step.label === "install"
                ? { ...step, status: "failed", error: "install failed" }
                : step,
            ),
          },
          ...source.cases.slice(1),
        ],
      },
      journeySourceCaseNames,
      undefined,
      "ci-reports/generated-apps",
    );

    expect(report.journeys.find(({ id }) => id === "create-app")).toMatchObject({
      status: "failed",
      failure: "install failed",
    });
    expect(report.journeys.find(({ id }) => id === "create-app")?.sourceArtifacts).toEqual([
      "cases/production-app-starter/stdout.log",
      "cases/production-app-starter/stderr.log",
      "cases/production-app-starter/files/package.json",
    ]);
  });

  it("fails a journey when its source case fails after the selected steps pass", () => {
    const source = createJourneySourceReport();
    const productionCase = source.cases[0];
    if (!productionCase) {
      throw new Error("missing production-app-starter fixture");
    }

    const report = createGeneratedSmokeJourneyReport(
      {
        ...source,
        status: "failed",
        failure: "production case failed",
        cases: [
          {
            ...productionCase,
            status: "failed",
            error: "production case failed",
          },
          ...source.cases.slice(1),
        ],
      },
      journeySourceCaseNames,
    );

    expect(report.journeys.find(({ id }) => id === "run-local-api")).toMatchObject({
      status: "failed",
      failure: "production case failed",
    });
  });

  it("fails loudly when a passed source case omits an exact journey selector", () => {
    const source = createJourneySourceReport();
    const productionCase = source.cases[0];
    if (!productionCase) {
      throw new Error("missing production-app-starter fixture");
    }

    expect(() =>
      createGeneratedSmokeJourneyReport(
        {
          ...source,
          cases: [
            {
              ...productionCase,
              steps: productionCase.steps.filter(({ label }) => label !== "Contract diff"),
            },
            ...source.cases.slice(1),
          ],
        },
        journeySourceCaseNames,
      ),
    ).toThrow("validate-contracts selector drift");
  });

  it("keeps not-yet-reached journeys pending during progressive writes", () => {
    const source = createJourneySourceReport();
    const report = createGeneratedSmokeJourneyReport(
      {
        ...source,
        status: "pending",
        cases: source.cases.map((smokeCase) => ({
          ...smokeCase,
          status: "pending",
          steps: [],
        })),
      },
      journeySourceCaseNames,
    );

    expect(report.status).toBe("pending");
    expect(
      report.journeys.every(
        ({ status, commands }) => status === "pending" && commands.length === 0,
      ),
    ).toBe(true);
  });

  it("propagates a terminal blocking bootstrap failure to every untouched journey", () => {
    const source = createJourneySourceReport();
    const bootstrapCommand = "node turbo build --filter=create-croco-app... --force";
    const report = createGeneratedSmokeJourneyReport(
      {
        ...source,
        status: "failed",
        failure: "bootstrap failed",
        gates: [
          {
            label: "create-croco-app CLI bootstrap",
            command: bootstrapCommand,
            tier: "spine-blocking",
            status: "failed",
            error: "bootstrap failed",
          },
        ],
        cases: source.cases.map((smokeCase) => ({
          ...smokeCase,
          status: "pending",
          steps: [],
        })),
      },
      journeySourceCaseNames,
    );

    expect(report.status).toBe("failed");
    expect(
      report.journeys.every(
        ({ status, commands, failure }) =>
          status === "failed" &&
          commands.includes(bootstrapCommand) &&
          failure === "bootstrap failed",
      ),
    ).toBe(true);
  });

  it("writes a self-contained bundle whose Markdown evidence links all resolve", () => {
    const root = createTempRoot();
    const sourceRoot = join(root, "source");
    const sourceArtifact = join(
      sourceRoot,
      "artifacts",
      "production-app-starter",
      "contract-graph.snapshot.json",
    );
    mkdirSync(dirname(sourceArtifact), { recursive: true });
    writeFileSync(sourceArtifact, '{"version":"croco.contract-graph.v1"}\n');
    const outputDir = join(root, "journeys");
    const report = createGeneratedSmokeJourneyReport(
      createJourneySourceReport(),
      journeySourceCaseNames,
    );

    writeGeneratedSmokeJourneyBundle(outputDir, report, sourceRoot);

    const markdown = readFileSync(join(outputDir, "report.md"), "utf8");
    expect(markdown).toBe(renderGeneratedSmokeJourneyReport(report));
    expect(readFileSync(join(outputDir, "report.json"), "utf8")).toContain(
      '"schemaVersion": "croco.generated-app-smoke-journeys/v1"',
    );
    for (const journey of report.journeys) {
      const relativePath = `evidence/${journey.id}.json`;
      expect(markdown).toContain(`[${relativePath}](${relativePath})`);
      expect(readFileSync(join(outputDir, relativePath), "utf8")).toContain(
        `"id": "${journey.id}"`,
      );
    }
    expect(
      readFileSync(
        join(
          outputDir,
          "proof",
          "artifacts",
          "production-app-starter",
          "contract-graph.snapshot.json",
        ),
        "utf8",
      ),
    ).toContain("croco.contract-graph.v1");
  });

  it("preserves the previous bundle when staging a replacement fails", () => {
    const outputDir = join(createTempRoot(), "journeys");
    const sentinelPath = join(outputDir, "sentinel.txt");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(sentinelPath, "previous bundle\n");
    const report = createGeneratedSmokeJourneyReport(
      createJourneySourceReport(),
      journeySourceCaseNames,
    );

    expect(() => writeGeneratedSmokeJourneyBundle(outputDir, report)).toThrow(
      "requires a source root",
    );
    expect(readFileSync(sentinelPath, "utf8")).toBe("previous bundle\n");
  });

  it("preserves the canonical bundle for advisory, unfiltered, and named selections", () => {
    const outputDir = join(createTempRoot(), "journeys");
    const sentinelPath = join(outputDir, "sentinel.txt");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(sentinelPath, "canonical\n");
    const rejectedSelections = [
      {
        selectedCaseNames: ["advisory"],
        spineCaseNames: journeySourceCaseNames,
        selectedTier: "ecosystem-advisory",
        requestedCaseNames: [],
      },
      {
        selectedCaseNames: [...journeySourceCaseNames, "advisory"],
        spineCaseNames: journeySourceCaseNames,
        requestedCaseNames: [],
      },
      {
        selectedCaseNames: ["production-app-starter"],
        spineCaseNames: journeySourceCaseNames,
        selectedTier: "spine-blocking",
        requestedCaseNames: ["production-app-starter"],
      },
      {
        selectedCaseNames: journeySourceCaseNames,
        spineCaseNames: journeySourceCaseNames,
        selectedTier: "spine-blocking",
        requestedCaseNames: journeySourceCaseNames,
      },
    ];

    for (const selection of rejectedSelections) {
      expect(isCanonicalGeneratedSmokeJourneySelection(selection)).toBe(false);
      expect(
        writeCanonicalGeneratedSmokeJourneyBundle({
          selection,
          outputDir,
          createReport: () => {
            throw new Error("partial selection must not project or write the canonical report");
          },
        }),
      ).toBe(false);
      expect(readFileSync(sentinelPath, "utf8")).toBe("canonical\n");
    }
    expect(
      isCanonicalGeneratedSmokeJourneySelection({
        selectedCaseNames: journeySourceCaseNames,
        spineCaseNames: journeySourceCaseNames,
        selectedTier: "spine-blocking",
        requestedCaseNames: [],
      }),
    ).toBe(true);
  });
});

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

  it("reports malformed generated secret allowlist metadata with smoke case context", () => {
    const root = createTempRoot();
    const metadataPath = join(root, "security-allowlist-metadata.json");
    writeFileSync(metadataPath, "{ invalid-json");

    expect(() => readGeneratedSmokeAllowlistMetadata(metadataPath, "saas-golden-path")).toThrow(
      /saas-golden-path generated secret allowlist metadata is invalid JSON:/,
    );
  });

  it("rejects generated Astryx metadata that drifts from the presentation profile catalog", () => {
    const root = createTempRoot();
    const projectDir = join(root, "generated-app");
    const catalogPath = join(root, "runtime-profiles.json");
    const ui = {
      name: "astryx",
      styleEngine: "stylex",
      requiresStylexCompile: false,
      maturity: "beta",
      generatedAppSmokeCase: "graphql-vite-spa-astryx",
    };
    const profile = { webApp: "web", runtimeProfile: "browser-vite-spa-astryx", ui };
    writeGeneratedPackage(projectDir, "apps/web/croco.presentation-profile.json", profile);
    writeGeneratedPackage(projectDir, "croco-presentation-profile.manifest.json", {
      schemaVersion: "croco.generated-presentation-profile/v1",
      profiles: [profile],
    });
    writeGeneratedPackage(root, "runtime-profiles.json", {
      profiles: [
        {
          name: "browser-vite-spa-astryx",
          generatedAppSmokeCase: "graphql-vite-spa-astryx",
          ui,
        },
      ],
    });

    expect(() =>
      assertGeneratedPresentationProfileMatchesCatalog(
        projectDir,
        "apps/web/croco.presentation-profile.json",
        "browser-vite-spa-astryx",
        "graphql-vite-spa-astryx",
        catalogPath,
      ),
    ).not.toThrow();

    writeGeneratedPackage(projectDir, "apps/web/croco.presentation-profile.json", {
      ...profile,
      ui: { ...ui, maturity: "alpha" },
    });
    expect(() =>
      assertGeneratedPresentationProfileMatchesCatalog(
        projectDir,
        "apps/web/croco.presentation-profile.json",
        "browser-vite-spa-astryx",
        "graphql-vite-spa-astryx",
        catalogPath,
      ),
    ).toThrow("does not match browser-vite-spa-astryx");
  });

  it("copies configured smoke artifacts into the report tree and renders matrix evidence", () => {
    const root = createTempRoot();
    const generatedProjectDir = join(root, "generated-app");
    const reportDir = join(root, "ci-reports", "generated-apps");
    const scenarioPath = "ci-reports/saas-golden-path/scenario.json";
    writeGeneratedPackage(generatedProjectDir, scenarioPath, {
      schemaVersion: "croco.saas-golden-path.scenario/v1",
    });

    const artifacts = copyGeneratedSmokeArtifacts({
      generatedSmokeReportDir: reportDir,
      smokeCaseName: "saas-golden-path",
      validationDir: generatedProjectDir,
      artifactPaths: [scenarioPath],
    });

    expect(artifacts).toEqual([
      {
        sourcePath: join(generatedProjectDir, scenarioPath),
        reportPath: join(
          reportDir,
          "artifacts",
          "saas-golden-path",
          "ci-reports",
          "saas-golden-path",
          "scenario.json",
        ),
        reportRelativePath: "artifacts/saas-golden-path/ci-reports/saas-golden-path/scenario.json",
      },
    ]);
    expect(readFileSync(artifacts[0].reportPath, "utf8")).toContain(
      '"schemaVersion": "croco.saas-golden-path.scenario/v1"',
    );
    expect(renderGeneratedSmokeArtifacts(artifacts)).toContain(
      "`artifacts/saas-golden-path/ci-reports/saas-golden-path/scenario.json`",
    );
  });
});

describe("create-croco-app generated smoke matrix", () => {
  it("keeps REST SPA contract canaries selectable in the blocking tier", () => {
    expect(
      GENERATED_SMOKE_MATRIX_CASES.find(({ name }) => name === "rest-spa-contracts")?.tier,
    ).toBe("spine-blocking");
    expect(
      selectGeneratedSmokeMatrixCases(GENERATED_SMOKE_MATRIX_CASES, {
        args: ["rest-spa-contracts"],
      }).cases.map(({ name }) => name),
    ).toEqual(["rest-spa-contracts"]);
  });

  it("classifies every generated smoke case and requires advisory recovery metadata", () => {
    expect(
      GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "spine-blocking").map(
        ({ name }) => name,
      ),
    ).toEqual([
      "graphql-lambda-api",
      "graphql-vite-spa-docker",
      "meta-vite-fullstack-workers",
      "production-app-starter",
      "saas-golden-path",
      "rest-spa-contracts",
    ]);
    expect(
      GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "ecosystem-advisory"),
    ).toHaveLength(12);
    const graphqlLambdaApiCase: SmokeMatrixCaseDefinition | undefined =
      GENERATED_SMOKE_MATRIX_CASES.find(({ name }) => name === "graphql-lambda-api");
    expect(graphqlLambdaApiCase?.advisory).toBeUndefined();

    expect(() =>
      assertGeneratedSmokeMatrixContract([
        {
          ...GENERATED_SMOKE_MATRIX_CASES[0],
          advisory: { owner: "", recoveryAction: "recover" },
        },
      ]),
    ).toThrow("requires owner and recoveryAction");
  });

  it("intersects named cases with the selected tier and rejects mismatches", () => {
    const selection = selectGeneratedSmokeMatrixCases(GENERATED_SMOKE_MATRIX_CASES, {
      args: ["--", "--tier", "spine-blocking"],
    });

    expect(selection.cases.map(({ name }) => name)).toEqual([
      "graphql-lambda-api",
      "graphql-vite-spa-docker",
      "meta-vite-fullstack-workers",
      "production-app-starter",
      "saas-golden-path",
      "rest-spa-contracts",
    ]);
    expect(() =>
      selectGeneratedSmokeMatrixCases(GENERATED_SMOKE_MATRIX_CASES, {
        args: ["--tier", "spine-blocking", "blank-basic"],
      }),
    ).toThrow("do not belong to selected tier spine-blocking");
  });

  it("preserves canonical tier state and rebuilds aggregate release status from spine evidence", () => {
    const spine = createGeneratedSmokeMatrixTierReport(
      "spine-blocking",
      GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "spine-blocking").map(
        ({ name }) => ({
          name,
          status: "passed" as const,
        }),
      ),
      { filteredRun: false, generatedAt: "2026-07-10T00:00:00.000Z" },
    );
    const firstAdvisory = createGeneratedSmokeMatrixTierReport(
      "ecosystem-advisory",
      [{ name: "blank-basic", status: "failed" }],
      { filteredRun: true, generatedAt: "2026-07-10T00:01:00.000Z" },
    );
    const advisory = createGeneratedSmokeMatrixTierReport(
      "ecosystem-advisory",
      [{ name: "goal-saas-api", status: "passed" }],
      {
        filteredRun: true,
        previousReport: firstAdvisory,
        generatedAt: "2026-07-10T00:02:00.000Z",
      },
    );
    const aggregate = createGeneratedSmokeMatrixAggregateReport(
      { "spine-blocking": spine, "ecosystem-advisory": advisory },
      "2026-07-10T00:03:00.000Z",
    );

    expect(advisory.cases.find(({ name }) => name === "blank-basic")?.status).toBe("failed");
    expect(advisory.cases.find(({ name }) => name === "goal-saas-api")?.status).toBe("passed");
    expect(aggregate.release.status).toBe("passed");
    expect(aggregate.status).toBe("failed");
    expect(renderGeneratedSmokeMatrixReport(advisory)).toContain(
      "create-croco-app blank template owner",
    );
    expect(renderGeneratedSmokeMatrixReport(advisory)).toContain(
      "CROCO_GENERATED_SMOKE_CASES=blank-basic pnpm create-croco-app:smoke",
    );
  });

  it("retains an owner and recovery action for tier-level failures", () => {
    const spine = createGeneratedSmokeMatrixTierReport(
      "spine-blocking",
      GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "spine-blocking").map(
        ({ name }) => ({
          name,
          status: "passed" as const,
        }),
      ),
      {
        filteredRun: true,
        failure: {
          message: "create-croco-app CLI bootstrap failed",
          owner: "create-croco-app release spine owner",
          recoveryAction: "Repair the bootstrap command and rerun the spine tier.",
        },
      },
    );

    expect(spine.status).toBe("failed");
    expect(renderGeneratedSmokeMatrixReport(spine)).toContain(
      "create-croco-app release spine owner",
    );
    expect(renderGeneratedSmokeMatrixReport(spine)).toContain(
      "Repair the bootstrap command and rerun the spine tier.",
    );
  });

  it("treats missing or stale tier reports as pending aggregate evidence", () => {
    const spine = createGeneratedSmokeMatrixTierReport(
      "spine-blocking",
      GENERATED_SMOKE_MATRIX_CASES.filter(({ tier }) => tier === "spine-blocking").map(
        ({ name }) => ({ name, status: "passed" as const }),
      ),
      { filteredRun: true, generatedAt: "2026-07-10T00:00:00.000Z" },
    );
    const advisory = createGeneratedSmokeMatrixTierReport(
      "ecosystem-advisory",
      [{ name: "blank-basic", status: "passed" }],
      { filteredRun: true, generatedAt: "2026-07-10T00:00:00.000Z" },
    );
    const aggregate = createGeneratedSmokeMatrixAggregateReport(
      {
        "spine-blocking": {
          ...spine,
          release: { ...spine.release, status: "pending" },
        },
        "ecosystem-advisory": advisory,
      },
      "2026-07-10T00:01:00.000Z",
    );

    expect(aggregate.release.status).toBe("pending");
    expect(aggregate.tiers).toContainEqual({ tier: "spine-blocking", status: "pending" });

    const aggregateWithStaleAdvisoryMetadata = createGeneratedSmokeMatrixAggregateReport(
      {
        "spine-blocking": spine,
        "ecosystem-advisory": {
          ...advisory,
          cases: advisory.cases.map((smokeCase) => ({
            ...smokeCase,
            advisory: { ...smokeCase.advisory, owner: "stale owner" },
          })),
        },
      },
      "2026-07-10T00:02:00.000Z",
    );

    expect(aggregateWithStaleAdvisoryMetadata.tiers).toContainEqual({
      tier: "ecosystem-advisory",
      status: "pending",
    });
  });
});

describe("create-croco-app generated smoke failure evidence", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("retains recovery details and artifact paths in the blocking-tier matrix report", () => {
    const spine = createGeneratedSmokeMatrixTierReport(
      "spine-blocking",
      [
        {
          name: "rest-spa-contracts",
          status: "failed",
          failureEvidence: {
            error: "contract graph drift detected",
            diagnosticCodes: ["CROCO_CONTRACT_DRIFT"],
            recovery: createSmokeRecoverySummary("rest-spa-contracts"),
            classification: classifySmokeFailure({ message: "contract graph drift detected" }),
            artifactBundle: {
              path: "ci-reports/generated-apps/cases/rest-spa-contracts",
              stdoutPath: "ci-reports/generated-apps/cases/rest-spa-contracts/stdout.log",
              stderrPath: "ci-reports/generated-apps/cases/rest-spa-contracts/stderr.log",
              files: [
                "ci-reports/generated-apps/cases/rest-spa-contracts/files/.croco/manifest/routes.json",
              ],
              outputTruncated: true,
            },
          },
        },
      ],
      { filteredRun: true, generatedAt: "2026-07-10T00:00:00.000Z" },
    );

    const rendered = renderGeneratedSmokeMatrixReport(spine);

    expect(spine.cases.find(({ name }) => name === "rest-spa-contracts")?.failureEvidence).toEqual(
      expect.objectContaining({ error: "contract graph drift detected" }),
    );
    expect(rendered).toContain("## Failed Case Recovery");
    expect(rendered).toContain("pnpm create-croco-app:smoke rest-spa-contracts");
    expect(rendered).toContain("ci-reports/generated-apps/cases/rest-spa-contracts/stdout.log");
    expect(rendered).toContain("truncated at 64 MiB");
  });

  it("classifies command output from captured stdout and stderr without assertion text", () => {
    const commandFailure = {
      message:
        "corepack pnpm check failed without expected output: ETIMEDOUT CROCO_EXPECTED_DIAGNOSTIC",
      stdout: "contract validation failed",
      stderr: "CROCO_CONTRACT_DRIFT",
      signal: null,
    };

    expect(extractSmokeCommandDiagnosticCodes(commandFailure)).toEqual(["CROCO_CONTRACT_DRIFT"]);
    expect(classifySmokeCommandFailure(commandFailure)).toEqual({
      kind: "deterministic",
      reason:
        "no transient timeout, network, DNS, socket, fetch, or termination indicator detected",
    });
  });

  it("reads complete Unicode command-output segments", () => {
    const root = createTempRoot();
    const outputPath = join(root, "command-output.log");
    const output = "first line\\nemoji: \\u{1F642}\\nlast line\\n";
    writeFileSync(outputPath, output, "utf8");

    const fileDescriptor = openSync(outputPath, "r");
    try {
      expect(readCommandOutputSegment(fileDescriptor, Buffer.byteLength(output), 0)).toBe(output);
    } finally {
      closeSync(fileDescriptor);
    }
  });

  it("keeps only relevant generated files in a failure artifact bundle", () => {
    const projectDir = createTempRoot();
    writeFile(join(projectDir, "package.json"), "{}\n");
    writeFile(join(projectDir, ".croco/manifest/routes.json"), "{}\n");
    writeFile(
      join(projectDir, "apps/api-server/src/controllers/userSchemas.ts"),
      "export const userSchemas = {};\n",
    );
    writeFile(join(projectDir, "node_modules/example/package.json"), "{}\n");

    const artifactPaths = collectSmokeFailureArtifactFiles(projectDir, "rest-spa-contracts").map(
      (path) => path.slice(projectDir.length + 1),
    );

    expect(shouldIncludeSmokeFailureArtifact("croco-runtime-capability.manifest.json")).toBe(true);
    expect(shouldIncludeSmokeFailureArtifact("node_modules/package/package.json")).toBe(false);
    expect(shouldSkipSmokeArtifactDirectory(".next")).toBe(true);
    expect(artifactPaths).toContain(".croco/manifest/routes.json");
    expect(artifactPaths).toContain("apps/api-server/src/controllers/userSchemas.ts");
    expect(artifactPaths).toContain("package.json");
    expect(artifactPaths).not.toContain("node_modules/example/package.json");
  });
});

function createJourneySourceReport(): GeneratedSmokeJourneySourceReport {
  const step = (
    label: string,
    command: string,
    options: {
      readonly artifacts?: readonly string[];
      readonly diagnosticCodes?: readonly string[];
    } = {},
  ) => ({
    label,
    command,
    artifacts: (options.artifacts ?? []).map((reportRelativePath) => ({ reportRelativePath })),
    status: "passed" as const,
    diagnosticCodes: options.diagnosticCodes ?? [],
  });

  return {
    generatedAt: "2026-07-11T00:00:00.000Z",
    status: "passed",
    gates: [],
    cases: [
      {
        name: "production-app-starter",
        status: "passed",
        recovery: {
          localRerunCommand: "pnpm create-croco-app:smoke production-app-starter",
        },
        steps: [
          step("generate", "node create-croco-app production-app-starter"),
          step("install", "pnpm install"),
          step("dev smoke", "pnpm dev:smoke"),
          step("Contract snapshot", "pnpm contract:snapshot", {
            artifacts: ["artifacts/production-app-starter/contract-graph.snapshot.json"],
          }),
          step("Contract coverage", "pnpm contract:coverage"),
          step("Contract diff", "pnpm contract:diff"),
          step("OpenAPI contract", "pnpm contract:openapi"),
          step("RPC client", "pnpm contract:client"),
          step("DI graph verify", "pnpm di:verify"),
        ],
      },
      {
        name: "graphql-lambda-api",
        status: "passed",
        recovery: { localRerunCommand: "pnpm create-croco-app:smoke graphql-lambda-api" },
        steps: [
          step(
            "protected GraphQL route smoke",
            "pnpm --dir apps/graphql-api exec tsx --eval <lambda-handler-smoke>",
          ),
        ],
      },
      {
        name: "rest-spa-contracts",
        status: "passed",
        recovery: { localRerunCommand: "pnpm create-croco-app:smoke rest-spa-contracts" },
        steps: [
          step("strict Problem declaration canary", "pnpm exec croco-rpc-codegen --check", {
            diagnosticCodes: ["contract-route-missing-problem-response-contract"],
          }),
          step("strict OpenAPI schema canary", "pnpm exec croco-openapi-spec"),
          step("strict RPC schema canary", "pnpm exec croco-rpc-codegen"),
        ],
      },
    ],
  };
}

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

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

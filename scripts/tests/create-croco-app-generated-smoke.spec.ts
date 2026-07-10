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
  assertGeneratedSmokeMatrixContract,
  createGeneratedSmokeMatrixAggregateReport,
  createGeneratedSmokeMatrixTierReport,
  GENERATED_SMOKE_MATRIX_CASES,
  renderGeneratedSmokeMatrixReport,
  selectGeneratedSmokeMatrixCases,
} from "../create-croco-app-generated-smoke-matrix.mts";
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

  it("reports malformed generated secret allowlist metadata with smoke case context", () => {
    const root = createTempRoot();
    const metadataPath = join(root, "security-allowlist-metadata.json");
    writeFileSync(metadataPath, "{ invalid-json");

    expect(() => readGeneratedSmokeAllowlistMetadata(metadataPath, "saas-golden-path")).toThrow(
      /saas-golden-path generated secret allowlist metadata is invalid JSON:/,
    );
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
    ).toHaveLength(11);
    expect(
      GENERATED_SMOKE_MATRIX_CASES.find(({ name }) => name === "graphql-lambda-api")?.advisory,
    ).toBeUndefined();

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

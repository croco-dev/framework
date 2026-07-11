import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";

export const GENERATED_SMOKE_JOURNEY_SCHEMA_VERSION =
  "croco.generated-app-smoke-journeys/v1" as const;

export type GeneratedSmokeJourneyStatus = "pending" | "passed" | "failed";

export type GeneratedSmokeJourneySourceStep = {
  readonly label: string;
  readonly command?: string;
  readonly artifacts: readonly { readonly reportRelativePath: string }[];
  readonly status: GeneratedSmokeJourneyStatus;
  readonly diagnosticCodes: readonly string[];
  readonly error?: string;
};

export type GeneratedSmokeJourneySourceCase = {
  readonly name: string;
  readonly status: GeneratedSmokeJourneyStatus;
  readonly steps: readonly GeneratedSmokeJourneySourceStep[];
  readonly recovery: { readonly localRerunCommand: string };
  readonly artifactBundle?: {
    readonly stdoutPath: string;
    readonly stderrPath: string;
    readonly files: readonly string[];
  };
  readonly error?: string;
};

export type GeneratedSmokeJourneySourceReport = {
  readonly generatedAt: string;
  readonly status: GeneratedSmokeJourneyStatus;
  readonly failure?: string;
  readonly gates: readonly {
    readonly label: string;
    readonly command: string;
    readonly tier: string;
    readonly status: GeneratedSmokeJourneyStatus;
    readonly error?: string;
  }[];
  readonly cases: readonly GeneratedSmokeJourneySourceCase[];
};

export type GeneratedSmokeJourneySourceSelector = {
  readonly caseName: string;
  readonly stepLabels: readonly string[];
};

export type GeneratedSmokeJourneyDefinition = {
  readonly id:
    | "create-app"
    | "run-local-api"
    | "validate-contracts"
    | "generate-openapi-rpc"
    | "run-lambda-handler"
    | "run-doctor"
    | "handle-expected-failures";
  readonly title: string;
  readonly selectors: readonly GeneratedSmokeJourneySourceSelector[];
};

export type GeneratedSmokeJourney = {
  readonly id: GeneratedSmokeJourneyDefinition["id"];
  readonly title: string;
  readonly status: GeneratedSmokeJourneyStatus;
  readonly sourceSelectors: readonly GeneratedSmokeJourneySourceSelector[];
  readonly commands: readonly string[];
  readonly artifacts: readonly string[];
  readonly sourceArtifacts: readonly string[];
  readonly diagnosticCodes: readonly string[];
  readonly recoveryAction: string;
  readonly failure?: string;
};

export type GeneratedSmokeJourneyReport = {
  readonly schemaVersion: typeof GENERATED_SMOKE_JOURNEY_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly status: GeneratedSmokeJourneyStatus;
  readonly journeys: readonly GeneratedSmokeJourney[];
};

export type GeneratedSmokeJourneySelection = {
  readonly selectedCaseNames: readonly string[];
  readonly spineCaseNames: readonly string[];
  readonly selectedTier?: string;
  readonly requestedCaseNames: readonly string[];
};

export const GENERATED_SMOKE_JOURNEY_DEFINITIONS: readonly GeneratedSmokeJourneyDefinition[] = [
  {
    id: "create-app",
    title: "Create app",
    selectors: [
      {
        caseName: "production-app-starter",
        stepLabels: ["generate", "install"],
      },
    ],
  },
  {
    id: "run-local-api",
    title: "Run local API",
    selectors: [{ caseName: "production-app-starter", stepLabels: ["dev smoke"] }],
  },
  {
    id: "validate-contracts",
    title: "Validate contracts",
    selectors: [
      {
        caseName: "production-app-starter",
        stepLabels: ["Contract snapshot", "Contract coverage", "Contract diff"],
      },
    ],
  },
  {
    id: "generate-openapi-rpc",
    title: "Generate OpenAPI and RPC",
    selectors: [
      {
        caseName: "production-app-starter",
        stepLabels: ["OpenAPI contract", "RPC client"],
      },
    ],
  },
  {
    id: "run-lambda-handler",
    title: "Run Lambda handler",
    selectors: [
      {
        caseName: "graphql-lambda-api",
        stepLabels: ["protected GraphQL route smoke"],
      },
    ],
  },
  {
    id: "run-doctor",
    title: "Run doctor",
    selectors: [{ caseName: "production-app-starter", stepLabels: ["DI graph verify"] }],
  },
  {
    id: "handle-expected-failures",
    title: "Handle expected failures",
    selectors: [
      {
        caseName: "rest-spa-contracts",
        stepLabels: [
          "strict Problem declaration canary",
          "strict OpenAPI schema canary",
          "strict RPC schema canary",
        ],
      },
    ],
  },
] as const;

export function isCanonicalGeneratedSmokeJourneySelection(
  selection: GeneratedSmokeJourneySelection,
): boolean {
  const selected = new Set(selection.selectedCaseNames);
  return (
    selection.selectedTier === "spine-blocking" &&
    selection.requestedCaseNames.length === 0 &&
    selection.spineCaseNames.length > 0 &&
    selected.size === selection.spineCaseNames.length &&
    selection.spineCaseNames.every((caseName) => selected.has(caseName))
  );
}

export function createGeneratedSmokeJourneyReport(
  source: GeneratedSmokeJourneySourceReport,
  availableCaseNames: readonly string[],
  definitions: readonly GeneratedSmokeJourneyDefinition[] = GENERATED_SMOKE_JOURNEY_DEFINITIONS,
  sourceReportPathPrefix = "",
): GeneratedSmokeJourneyReport {
  assertJourneyDefinitions(definitions, availableCaseNames);
  const blockingGateFailure = source.gates.find(
    (gate) => gate.tier === "spine-blocking" && gate.status === "failed",
  );
  const journeys = definitions.map((definition) =>
    createJourney(source, definition, blockingGateFailure, sourceReportPathPrefix),
  );

  const report = {
    schemaVersion: GENERATED_SMOKE_JOURNEY_SCHEMA_VERSION,
    generatedAt: source.generatedAt,
    status: aggregateStatus(journeys.map(({ status }) => status)),
    journeys,
  };
  assertGeneratedSmokeJourneyReport(report);
  return report;
}

export function writeGeneratedSmokeJourneyBundle(
  outputDir: string,
  report: GeneratedSmokeJourneyReport,
  sourceRootDir?: string,
): void {
  assertGeneratedSmokeJourneyReport(report);
  const stagingDir = `${outputDir}.tmp-${process.pid}`;
  rmSync(stagingDir, { force: true, recursive: true });

  try {
    writeGeneratedSmokeJourneyBundleDirectory(stagingDir, report, sourceRootDir);
    mkdirSync(dirname(outputDir), { recursive: true });
    rmSync(outputDir, { force: true, recursive: true });
    renameSync(stagingDir, outputDir);
  } finally {
    rmSync(stagingDir, { force: true, recursive: true });
  }
}

function writeGeneratedSmokeJourneyBundleDirectory(
  outputDir: string,
  report: GeneratedSmokeJourneyReport,
  sourceRootDir?: string,
): void {
  const evidenceDir = join(outputDir, "evidence");
  mkdirSync(evidenceDir, { recursive: true });

  for (const journey of report.journeys) {
    writeFileSync(join(evidenceDir, `${journey.id}.json`), `${JSON.stringify(journey, null, 2)}\n`);
    for (const sourceArtifact of journey.sourceArtifacts) {
      if (!sourceRootDir) {
        throw new Error(`${journey.id} requires a source root for ${sourceArtifact}`);
      }
      const sourcePath = join(sourceRootDir, sourceArtifact);
      const proofPath = join(outputDir, toJourneyProofPath(sourceArtifact));
      if (!existsSync(sourcePath)) {
        throw new Error(`${journey.id} source artifact does not exist: ${sourceArtifact}`);
      }
      mkdirSync(dirname(proofPath), { recursive: true });
      copyFileSync(sourcePath, proofPath);
    }
  }

  writeFileSync(join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(outputDir, "report.md"), renderGeneratedSmokeJourneyReport(report));
  assertGeneratedSmokeJourneyLinks(outputDir, report);
}

export function writeCanonicalGeneratedSmokeJourneyBundle(options: {
  readonly selection: GeneratedSmokeJourneySelection;
  readonly outputDir: string;
  readonly createReport: () => GeneratedSmokeJourneyReport;
  readonly sourceRootDir?: string;
}): boolean {
  if (!isCanonicalGeneratedSmokeJourneySelection(options.selection)) {
    return false;
  }
  writeGeneratedSmokeJourneyBundle(
    options.outputDir,
    options.createReport(),
    options.sourceRootDir,
  );
  return true;
}

export function renderGeneratedSmokeJourneyReport(report: GeneratedSmokeJourneyReport): string {
  assertGeneratedSmokeJourneyReport(report);
  return [
    "# Generated app smoke journeys",
    "",
    `Overall status: **${report.status}**`,
    "",
    "| Journey | Status | Commands | Evidence | Recovery |",
    "| --- | --- | --- | --- | --- |",
    ...report.journeys.map((journey) =>
      [
        escapeMarkdown(journey.title),
        journey.status,
        escapeMarkdown(journey.commands.join("<br>")),
        journey.artifacts.map((path) => `[${path}](${path})`).join("<br>"),
        escapeMarkdown(journey.recoveryAction),
      ].join(" | "),
    ),
    "",
  ].join("\n");
}

export function assertGeneratedSmokeJourneyLinks(
  outputDir: string,
  report: GeneratedSmokeJourneyReport,
): void {
  assertGeneratedSmokeJourneyReport(report);
  for (const journey of report.journeys) {
    for (const artifact of journey.artifacts) {
      assertSafeRelativePath(artifact, `${journey.id}.artifacts`);
      if (!existsSync(join(outputDir, artifact))) {
        throw new Error(`${journey.id} has a missing journey artifact link: ${artifact}`);
      }
    }
  }
}

function createJourney(
  source: GeneratedSmokeJourneySourceReport,
  definition: GeneratedSmokeJourneyDefinition,
  blockingGateFailure: GeneratedSmokeJourneySourceReport["gates"][number] | undefined,
  sourceReportPathPrefix: string,
): GeneratedSmokeJourney {
  const sourceSteps: GeneratedSmokeJourneySourceStep[] = [];
  const sourceCases: GeneratedSmokeJourneySourceCase[] = [];
  let blockedCase: GeneratedSmokeJourneySourceCase | undefined;

  for (const selector of definition.selectors) {
    const sourceCase = source.cases.find(({ name }) => name === selector.caseName);
    if (!sourceCase) {
      throw new Error(`${definition.id} source report omitted selected case ${selector.caseName}`);
    }
    sourceCases.push(sourceCase);

    for (const label of selector.stepLabels) {
      const step = sourceCase.steps.find((candidate) => candidate.label === label);
      if (step) {
        sourceSteps.push(step);
      } else if (sourceCase.status === "passed") {
        throw new Error(
          `${definition.id} selector drift: ${sourceCase.name} omitted passed step ${label}`,
        );
      } else {
        blockedCase ??= sourceCase;
      }
    }
  }

  const status = blockingGateFailure
    ? "failed"
    : sourceCases.some(({ status: caseStatus }) => caseStatus === "failed")
      ? "failed"
      : blockedCase?.status === "failed"
        ? "failed"
        : aggregateStatus(sourceSteps.map(({ status }) => status));
  const recoveryAction =
    blockingGateFailure?.command ??
    blockedCase?.recovery.localRerunCommand ??
    sourceCases[0]?.recovery.localRerunCommand;
  if (!recoveryAction) {
    throw new Error(`${definition.id} has no source case recovery command`);
  }
  const commands = unique([
    ...(blockingGateFailure ? [blockingGateFailure.command] : []),
    ...sourceSteps.flatMap(({ command }) => (command ? [command] : [])),
  ]);
  const failure =
    blockingGateFailure?.error ??
    (blockingGateFailure ? blockingGateFailure.label : undefined) ??
    sourceSteps.find(({ status: stepStatus }) => stepStatus === "failed")?.error ??
    blockedCase?.error ??
    sourceCases.find(({ status: caseStatus }) => caseStatus === "failed")?.error ??
    (status === "failed" ? source.failure : undefined);
  const sourceArtifacts = unique([
    ...sourceSteps.flatMap(({ artifacts }) =>
      artifacts.map(({ reportRelativePath }) =>
        normalizeSourceArtifactPath(reportRelativePath, sourceReportPathPrefix),
      ),
    ),
    ...sourceCases.flatMap(({ artifactBundle }) =>
      artifactBundle
        ? [artifactBundle.stdoutPath, artifactBundle.stderrPath, ...artifactBundle.files].map(
            (path) => normalizeSourceArtifactPath(path, sourceReportPathPrefix),
          )
        : [],
    ),
  ]);

  return {
    id: definition.id,
    title: definition.title,
    status,
    sourceSelectors: definition.selectors.map(({ caseName, stepLabels }) => ({
      caseName,
      stepLabels: [...stepLabels],
    })),
    commands,
    artifacts: [
      `evidence/${definition.id}.json`,
      ...sourceArtifacts.map((sourceArtifact) => toJourneyProofPath(sourceArtifact)),
    ],
    sourceArtifacts,
    diagnosticCodes: unique(sourceSteps.flatMap(({ diagnosticCodes }) => diagnosticCodes)),
    recoveryAction,
    ...(failure ? { failure } : {}),
  };
}

function assertJourneyDefinitions(
  definitions: readonly GeneratedSmokeJourneyDefinition[],
  availableCaseNames: readonly string[],
): void {
  const expectedIds = GENERATED_SMOKE_JOURNEY_DEFINITIONS.map(({ id }) => id);
  const actualIds = definitions.map(({ id }) => id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`Generated smoke journey IDs must be ${expectedIds.join(", ")}`);
  }

  const availableCases = new Set(availableCaseNames);
  for (const definition of definitions) {
    for (const selector of definition.selectors) {
      if (!availableCases.has(selector.caseName)) {
        throw new Error(`${definition.id} references unknown smoke case ${selector.caseName}`);
      }
    }
  }
}

export function assertGeneratedSmokeJourneyReport(
  value: unknown,
): asserts value is GeneratedSmokeJourneyReport {
  if (!isRecord(value)) {
    throw new Error("Generated smoke journey report must be an object");
  }
  if (value.schemaVersion !== GENERATED_SMOKE_JOURNEY_SCHEMA_VERSION) {
    throw new Error(
      `Unknown generated smoke journey schema version: ${String(value.schemaVersion)}`,
    );
  }
  assertNonEmptyString(value.generatedAt, "generatedAt");
  assertJourneyStatus(value.status, "status");
  if (!Array.isArray(value.journeys)) {
    throw new Error("Generated smoke journey report journeys must be an array");
  }

  const expectedIds = GENERATED_SMOKE_JOURNEY_DEFINITIONS.map(({ id }) => id);
  const seenIds = new Set<string>();
  for (const [index, journey] of value.journeys.entries()) {
    if (!isRecord(journey)) {
      throw new Error(`Generated smoke journey at index ${index} must be an object`);
    }
    assertNonEmptyString(journey.id, `journeys[${index}].id`);
    if (seenIds.has(journey.id)) {
      throw new Error(`Generated smoke journey report has duplicate journey ID: ${journey.id}`);
    }
    seenIds.add(journey.id);
    if (journey.id !== expectedIds[index]) {
      throw new Error(`Generated smoke journey IDs must be ${expectedIds.join(", ")}`);
    }
    const expectedDefinition = GENERATED_SMOKE_JOURNEY_DEFINITIONS[index];
    if (!expectedDefinition) {
      throw new Error(`Generated smoke journey definition is missing at index ${index}`);
    }
    assertNonEmptyString(journey.title, `${journey.id}.title`);
    if (journey.title !== expectedDefinition.title) {
      throw new Error(`${journey.id}.title does not match the canonical journey definition`);
    }
    assertJourneyStatus(journey.status, `${journey.id}.status`);
    assertSourceSelectors(journey.sourceSelectors, journey.id);
    if (JSON.stringify(journey.sourceSelectors) !== JSON.stringify(expectedDefinition.selectors)) {
      throw new Error(
        `${journey.id}.sourceSelectors do not match the canonical journey definition`,
      );
    }
    assertStringArray(journey.commands, `${journey.id}.commands`);
    assertStringArray(journey.artifacts, `${journey.id}.artifacts`);
    assertStringArray(journey.sourceArtifacts, `${journey.id}.sourceArtifacts`);
    assertStringArray(journey.diagnosticCodes, `${journey.id}.diagnosticCodes`);
    assertNonEmptyString(journey.recoveryAction, `${journey.id}.recoveryAction`);
    if (journey.failure !== undefined) {
      assertNonEmptyString(journey.failure, `${journey.id}.failure`);
    }

    const expectedEvidencePath = `evidence/${journey.id}.json`;
    if (!journey.artifacts.includes(expectedEvidencePath)) {
      throw new Error(`${journey.id} must link ${expectedEvidencePath}`);
    }
    for (const artifact of journey.artifacts) {
      assertSafeRelativePath(artifact, `${journey.id}.artifacts`);
    }
    for (const sourceArtifact of journey.sourceArtifacts) {
      assertSafeRelativePath(sourceArtifact, `${journey.id}.sourceArtifacts`);
      if (!journey.artifacts.includes(toJourneyProofPath(sourceArtifact))) {
        throw new Error(`${journey.id} does not link copied source artifact ${sourceArtifact}`);
      }
    }
  }

  if (value.journeys.length !== expectedIds.length) {
    throw new Error(`Generated smoke journey IDs must be ${expectedIds.join(", ")}`);
  }
  const aggregatedStatus = aggregateStatus(
    value.journeys.map((journey) => journey.status as GeneratedSmokeJourneyStatus),
  );
  if (value.status !== aggregatedStatus) {
    throw new Error(
      `Generated smoke journey report status ${String(value.status)} does not match ${aggregatedStatus}`,
    );
  }
}

function assertSourceSelectors(value: unknown, journeyId: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${journeyId}.sourceSelectors must be a non-empty array`);
  }
  for (const [index, selector] of value.entries()) {
    if (!isRecord(selector)) {
      throw new Error(`${journeyId}.sourceSelectors[${index}] must be an object`);
    }
    assertNonEmptyString(selector.caseName, `${journeyId}.sourceSelectors[${index}].caseName`);
    assertStringArray(
      selector.stepLabels,
      `${journeyId}.sourceSelectors[${index}].stepLabels`,
      true,
    );
  }
}

function assertStringArray(
  value: unknown,
  label: string,
  requireNonEmpty = false,
): asserts value is string[] {
  if (!Array.isArray(value) || (requireNonEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${requireNonEmpty ? "a non-empty" : "an"} array`);
  }
  for (const entry of value) {
    assertNonEmptyString(entry, label);
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertJourneyStatus(
  value: unknown,
  label: string,
): asserts value is GeneratedSmokeJourneyStatus {
  if (value !== "pending" && value !== "passed" && value !== "failed") {
    throw new Error(`${label} has unknown status: ${String(value)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSourceArtifactPath(path: string, sourceReportPathPrefix: string): string {
  const normalizedPath = path.replaceAll("\\", "/");
  const normalizedPrefix = sourceReportPathPrefix.replaceAll("\\", "/").replace(/\/$/, "");
  const relativePath =
    normalizedPrefix && normalizedPath.startsWith(`${normalizedPrefix}/`)
      ? normalizedPath.slice(normalizedPrefix.length + 1)
      : normalizedPath;
  assertSafeRelativePath(relativePath, "source artifact");
  return relativePath;
}

function toJourneyProofPath(sourceArtifact: string): string {
  return `proof/${sourceArtifact}`;
}

function assertSafeRelativePath(path: string, label: string): void {
  const normalizedPath = path.replaceAll("\\", "/");
  if (
    normalizedPath.length === 0 ||
    isAbsolute(path) ||
    /^[A-Za-z]:\//.test(normalizedPath) ||
    normalizedPath.split("/").includes("..")
  ) {
    throw new Error(`${label} contains an unsafe path: ${path}`);
  }
}

function aggregateStatus(
  statuses: readonly GeneratedSmokeJourneyStatus[],
): GeneratedSmokeJourneyStatus {
  if (statuses.includes("failed")) {
    return "failed";
  }
  if (statuses.length > 0 && statuses.every((status) => status === "passed")) {
    return "passed";
  }
  return "pending";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

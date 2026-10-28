import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertTestEvidenceBundle,
  assertTestEvidenceRecord,
  createTestEvidenceBundle,
  createTestEvidenceRecord,
  renderTestEvidenceMarkdown,
  serializeTestEvidence,
} from "./test-evidence-runtime.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";
import type { ReleaseSpineEvidenceReport } from "./release-spine-evidence.mts";
import type { TestEvidenceRecord } from "../packages/testing/src/libs/test-evidence.mts";

const RELEASE_EVIDENCE_SCHEMA_VERSION = "croco.release-spine-evidence/v1";

// Manifest categories are descriptive metadata, including native categories such as security.
type ReleaseEvidenceReport = Omit<ReleaseSpineEvidenceReport, "checks"> & {
  readonly checks: readonly (Omit<ReleaseSpineEvidenceReport["checks"][number], "category"> & {
    readonly category: string;
  })[];
};

export function normalizeTestEvidenceInput(
  value: unknown,
  sourcePath: string,
): readonly TestEvidenceRecord[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      assertTestEvidenceRecord(entry);
      return entry;
    });
  }
  if (
    isRecord(value) &&
    value.schemaVersion === "croco.test-evidence/v1" &&
    Array.isArray(value.records)
  ) {
    assertTestEvidenceBundle(value);
    return value.records;
  }
  if (isRecord(value) && Array.isArray(value.checks)) {
    return normalizeReleaseEvidence(value, sourcePath);
  }
  assertTestEvidenceRecord(value);
  return [value];
}

export function normalizeReleaseEvidence(
  report: unknown,
  sourcePath: string,
): readonly TestEvidenceRecord[] {
  assertReleaseEvidenceReport(report);
  const profile = report.profile;
  const source = sourcePath.replace(/\\/g, "/");
  return report.checks.map((check) => {
    const id = check.id;
    const label = check.label;
    const outcome =
      check.status === "passed"
        ? "passed"
        : check.status === "not_applicable"
          ? "skipped"
          : "failed";
    const artifactPaths =
      outcome === "skipped"
        ? []
        : check.artifacts
            .filter(({ required }) => required !== false)
            .flatMap(({ path, sourcePath: artifactSource }) => {
              const artifactPath = nonEmpty(artifactSource) ?? nonEmpty(path);
              return artifactPath ? [artifactPath] : [];
            });
    return createTestEvidenceRecord({
      id: `verification/${profile}/${id}`,
      runner: "croco-verification",
      intent: { contractIds: [id], description: label },
      observed: { contractIds: outcome === "passed" ? [id] : [] },
      fidelity: {
        boot: "isolated",
        dependency: "fake",
        isolation: "fake",
        runtime: "node",
        validation: "isolated",
      },
      replay: { command: check.command.join(" ") },
      diagnostics:
        outcome === "failed"
          ? [
              {
                code: nonEmpty(check.errorCode) ?? "CROCO_VERIFICATION_FAILED",
                recoveryAction:
                  nonEmpty(check.failureReason) ??
                  `Rerun verification check '${id}' and inspect its report.`,
              },
            ]
          : [],
      resources: { leaks: [], status: "not-checked" },
      attachments: [
        { kind: "report", path: source, schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION },
        ...artifactPaths.map((path) => ({ kind: "report" as const, path })),
      ],
      attempts: [
        {
          attempt: 1,
          outcome,
          ...(typeof check.durationMs === "number" ? { durationMs: check.durationMs } : {}),
        },
      ],
      ...(typeof check.durationMs === "number" ? { timing: { durationMs: check.durationMs } } : {}),
      metadata: {
        category: check.category,
        profile,
        commitSha: report.provenance.commitSha,
        sourceSchemaVersion: report.schemaVersion,
        sourceProvenance: {
          commitSha: report.provenance.commitSha,
          runId: report.provenance.runId,
          runAttempt: report.provenance.runAttempt,
          ...(report.provenance.verificationIdentity
            ? { verificationIdentity: { ...report.provenance.verificationIdentity } }
            : {}),
        },
      },
    });
  });
}

// Validate the source report before assigning the adapter's attachment schema tag.
function assertReleaseEvidenceReport(value: unknown): asserts value is ReleaseEvidenceReport {
  const report = releaseObject(value, "report");
  requireReleaseField(report.schemaVersion === 1, "report.schemaVersion");
  requireReleaseField(
    ["repo", "spine", "publish"].includes(report.profile as string),
    "report.profile",
  );
  requireReleaseField(
    ["running", "passed", "failed", "timed_out", "interrupted"].includes(report.status as string),
    "report.status",
  );
  for (const field of ["generatedAt", "outputDir", "rootDir"]) {
    requireReleaseField(nonEmpty(report[field]) !== undefined, `report.${field}`);
  }
  requireReleaseField(nullableString(report.completedAt), "report.completedAt");
  requireReleaseField(nonNegativeNumber(report.totalTimeoutMs), "report.totalTimeoutMs");
  const provenance = releaseObject(report.provenance, "report.provenance");
  for (const field of ["commitSha", "runId", "runAttempt"]) {
    requireReleaseField(nonEmpty(provenance[field]) !== undefined, `report.provenance.${field}`);
  }
  if (provenance.verificationIdentity !== undefined) {
    const identity = releaseObject(
      provenance.verificationIdentity,
      "report.provenance.verificationIdentity",
    );
    for (const field of ["baseSha", "headSha", "candidateSha"]) {
      requireReleaseField(
        nonEmpty(identity[field]) !== undefined,
        `report.provenance.verificationIdentity.${field}`,
      );
    }
  }
  const summary = releaseObject(report.summary, "report.summary");
  for (const field of [
    "failed",
    "interrupted",
    "notApplicable",
    "passed",
    "pending",
    "running",
    "skippedAfterTimeout",
    "skippedPrerequisite",
    "timedOut",
    "total",
  ]) {
    requireReleaseField(
      nonNegativeNumber(summary[field]) && Number.isSafeInteger(summary[field]),
      `report.summary.${field}`,
    );
  }
  requireReleaseField(Array.isArray(report.checks), "report.checks");
  const checks = report.checks as unknown[];
  for (const [index, entry] of checks.entries()) {
    const path = `report.checks[${index}]`;
    const check = releaseObject(entry, path);
    for (const field of ["id", "label"]) {
      requireReleaseField(nonEmpty(check[field]) !== undefined, `${path}.${field}`);
    }
    requireReleaseField(nonEmpty(check.category) !== undefined, `${path}.category`);
    requireReleaseField(
      [
        "pending",
        "running",
        "passed",
        "failed",
        "timed_out",
        "interrupted",
        "skipped_after_timeout",
        "skipped_prerequisite",
        "not_applicable",
      ].includes(check.status as string),
      `${path}.status`,
    );
    requireReleaseField(stringArray(check.command), `${path}.command`);
    requireReleaseField(nonNegativeNumber(check.timeoutMs), `${path}.timeoutMs`);
    for (const field of ["durationMs", "effectiveTimeoutMs"]) {
      requireReleaseField(
        check[field] === null || nonNegativeNumber(check[field]),
        `${path}.${field}`,
      );
    }
    requireReleaseField(
      check.exitCode === null || Number.isSafeInteger(check.exitCode),
      `${path}.exitCode`,
    );
    for (const field of [
      "completedAt",
      "errorCode",
      "errorMessage",
      "failureReason",
      "signal",
      "startedAt",
    ]) {
      requireReleaseField(nullableString(check[field]), `${path}.${field}`);
    }
    for (const field of ["stderrExcerpt", "stdoutExcerpt"]) {
      requireReleaseField(typeof check[field] === "string", `${path}.${field}`);
    }
    requireReleaseField(Array.isArray(check.artifacts), `${path}.artifacts`);
    for (const [artifactIndex, artifactEntry] of (check.artifacts as unknown[]).entries()) {
      const artifactPath = `${path}.artifacts[${artifactIndex}]`;
      const artifact = releaseObject(artifactEntry, artifactPath);
      for (const field of ["label", "path", "sourcePath"]) {
        requireReleaseField(nonEmpty(artifact[field]) !== undefined, `${artifactPath}.${field}`);
      }
      for (const field of ["exists", "fresh", "required"]) {
        requireReleaseField(typeof artifact[field] === "boolean", `${artifactPath}.${field}`);
      }
      for (const field of ["copiedPath", "copyError", "modifiedAt"]) {
        requireReleaseField(nullableString(artifact[field]), `${artifactPath}.${field}`);
      }
    }
  }
}

function releaseObject(value: unknown, path: string): Record<string, unknown> {
  requireReleaseField(isRecord(value), path);
  return value as Record<string, unknown>;
}

function requireReleaseField(valid: boolean, path: string): void {
  if (!valid) {
    throw new VerificationProblem(
      "INVALID_RELEASE_EVIDENCE_REPORT",
      "input",
      `Invalid release evidence field '${path}'.`,
    );
  }
}

function nullableString(value: unknown): boolean {
  return value === null || typeof value === "string";
}

function nonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function stringArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => nonEmpty(entry) !== undefined)
  );
}

export function writeTestEvidenceBundle(options: {
  readonly inputPaths: readonly string[];
  readonly outputDirectory: string;
  readonly rootDirectory: string;
}): ReturnType<typeof createTestEvidenceBundle> {
  const records = options.inputPaths.flatMap((path) => {
    const absolutePath = resolve(options.rootDirectory, path);
    if (!existsSync(absolutePath)) {
      return [
        inputFailureRecord(
          path,
          "CROCO_TEST_EVIDENCE_INPUT_MISSING",
          "Produce the required evidence input before aggregation.",
        ),
      ];
    }
    const relativePath = relative(options.rootDirectory, absolutePath).replace(/\\/g, "/");
    try {
      return normalizeTestEvidenceInput(
        JSON.parse(readFileSync(absolutePath, "utf8")),
        relativePath,
      );
    } catch (error) {
      return [
        inputFailureRecord(
          relativePath,
          "CROCO_TEST_EVIDENCE_INPUT_INVALID",
          `Regenerate the input with a supported evidence schema before aggregation. Cause: ${errorMessage(error)}`,
        ),
      ];
    }
  });
  const bundle = createTestEvidenceBundle(records, (path) =>
    existsSync(resolve(options.rootDirectory, path)),
  );
  const outputDirectory = resolve(options.rootDirectory, options.outputDirectory);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, "bundle.json"), serializeTestEvidence(bundle));
  writeFileSync(resolve(outputDirectory, "summary.md"), renderTestEvidenceMarkdown(bundle));
  return bundle;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inputFailureRecord(
  path: string,
  code: string,
  recoveryAction: string,
): TestEvidenceRecord {
  const prefix = code === "CROCO_TEST_EVIDENCE_INPUT_MISSING" ? "missing-input" : "invalid-input";
  return createTestEvidenceRecord({
    id: `${prefix}/${path.replace(/[^a-zA-Z0-9._/-]/g, "-")}`,
    runner: "croco-verification",
    intent: { contractIds: [], description: `Load required evidence input ${path}` },
    observed: { contractIds: [] },
    fidelity: {
      boot: "isolated",
      dependency: "fake",
      isolation: "fake",
      runtime: "node",
      validation: "isolated",
    },
    replay: { command: `pnpm test-evidence:bundle --input ${path}` },
    diagnostics: [{ code, recoveryAction }],
    resources: { leaks: [], status: "not-checked" },
    attachments: [{ kind: "report", path }],
    attempts: [{ attempt: 1, outcome: "failed" }],
  });
}

export function parseArguments(args: readonly string[]): {
  readonly inputPaths: readonly string[];
  readonly outputDirectory: string;
} {
  const inputPaths: string[] = [];
  let outputDirectory = "ci-reports/test-evidence";
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--input") {
      const input = args[index + 1];
      if (!input) {
        throw new VerificationProblem(
          "MISSING_TEST_EVIDENCE_INPUT_PATH",
          "input",
          "--input requires a path.",
        );
      }
      inputPaths.push(input);
      index += 1;
    } else if (argument === "--output") {
      const output = args[index + 1];
      if (!output) {
        throw new VerificationProblem(
          "MISSING_TEST_EVIDENCE_OUTPUT_DIRECTORY",
          "input",
          "--output requires a directory.",
        );
      }
      outputDirectory = output;
      index += 1;
    } else {
      throw new VerificationProblem(
        "UNKNOWN_TEST_EVIDENCE_ARGUMENT",
        "input",
        `Unknown argument '${argument}'.`,
      );
    }
  }
  if (inputPaths.length === 0) {
    throw new VerificationProblem(
      "MISSING_TEST_EVIDENCE_INPUT",
      "input",
      "At least one --input path is required.",
    );
  }
  return { inputPaths, outputDirectory };
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const rootDirectory = resolve(dirname(currentFile), "..");
    const bundle = writeTestEvidenceBundle({ ...options, rootDirectory });
    process.stdout.write(renderTestEvidenceMarkdown(bundle));
    process.exitCode = bundle.status === "passed" ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${formatVerificationProblem(error)}\n`);
    process.exitCode = 1;
  }
}

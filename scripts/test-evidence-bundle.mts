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
import type { TestEvidenceRecord } from "../packages/testing/src/libs/test-evidence.mts";

const RELEASE_EVIDENCE_SCHEMA_VERSION = "croco.release-spine-evidence/v1";

type ReleaseEvidenceArtifact = {
  readonly exists?: boolean;
  readonly path?: string;
  readonly required?: boolean;
  readonly sourcePath?: string;
};

type ReleaseEvidenceCheck = {
  readonly artifacts?: readonly ReleaseEvidenceArtifact[];
  readonly category?: string;
  readonly command?: readonly string[];
  readonly durationMs?: number | null;
  readonly errorCode?: string | null;
  readonly failureReason?: string | null;
  readonly id?: string;
  readonly label?: string;
  readonly status?: string;
};

type ReleaseEvidenceReport = {
  readonly checks?: readonly ReleaseEvidenceCheck[];
  readonly profile?: string;
  readonly provenance?: { readonly commitSha?: string };
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
    return normalizeReleaseEvidence(value as ReleaseEvidenceReport, sourcePath);
  }
  assertTestEvidenceRecord(value);
  return [value];
}

export function normalizeReleaseEvidence(
  report: ReleaseEvidenceReport,
  sourcePath: string,
): readonly TestEvidenceRecord[] {
  const profile = nonEmpty(report.profile) ?? "unknown";
  const source = sourcePath.replace(/\\/g, "/");
  return (report.checks ?? []).map((check, index) => {
    const id = nonEmpty(check.id) ?? `check-${index + 1}`;
    const label = nonEmpty(check.label) ?? id;
    const outcome =
      check.status === "passed"
        ? "passed"
        : check.status === "not_applicable"
          ? "skipped"
          : "failed";
    const artifactPaths =
      outcome === "skipped"
        ? []
        : (check.artifacts ?? [])
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
      replay: { command: (check.command ?? []).join(" ") || `pnpm verification --id ${id}` },
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
        category: nonEmpty(check.category) ?? "unknown",
        profile,
        ...(nonEmpty(report.provenance?.commitSha)
          ? { commitSha: report.provenance?.commitSha ?? "" }
          : {}),
        sourceSchemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
      },
    });
  });
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

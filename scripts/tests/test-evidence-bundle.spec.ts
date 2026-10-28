import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  normalizeTestEvidenceInput,
  parseArguments,
  writeTestEvidenceBundle,
} from "../test-evidence-bundle.mts";
import { runReleaseSpineEvidence } from "../release-spine-evidence.mts";
import { getVerificationCommand } from "../verification-manifest.mts";
import { VerificationProblem } from "../verification-problem.mts";
import type {
  EvidenceArtifactReference,
  EvidenceCheckResult,
  ReleaseSpineEvidenceReport,
} from "../release-spine-evidence.mts";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function temporaryDirectory(): string {
  const directory = join(
    tmpdir(),
    `croco-test-evidence-${process.pid}-${Date.now()}-${temporaryDirectories.length}`,
  );
  mkdirSync(directory, { recursive: true });
  temporaryDirectories.push(directory);
  return directory;
}

function releaseCheck(overrides: Partial<EvidenceCheckResult> = {}): EvidenceCheckResult {
  return {
    id: "test",
    label: "Test",
    category: "quality",
    command: ["pnpm", "test"],
    timeoutMs: 1000,
    artifacts: [],
    completedAt: "2026-10-29T00:00:01.000Z",
    durationMs: 12,
    effectiveTimeoutMs: 1000,
    errorCode: null,
    errorMessage: null,
    exitCode: 0,
    failureReason: null,
    signal: null,
    startedAt: "2026-10-29T00:00:00.000Z",
    status: "passed",
    stderrExcerpt: "",
    stdoutExcerpt: "ok",
    ...overrides,
  };
}

function releaseReport(
  overrides: Partial<ReleaseSpineEvidenceReport> = {},
): ReleaseSpineEvidenceReport {
  return {
    schemaVersion: 1,
    profile: "spine",
    status: "passed",
    completedAt: "2026-10-29T00:00:01.000Z",
    generatedAt: "2026-10-29T00:00:00.000Z",
    outputDir: "/workspace/ci-reports/release",
    rootDir: "/workspace",
    totalTimeoutMs: 10000,
    provenance: {
      commitSha: "abc123",
      runId: "run-42",
      runAttempt: "2",
      verificationIdentity: {
        baseSha: "base-17",
        headSha: "head-23",
        candidateSha: "candidate-31",
      },
    },
    summary: {
      failed: 0,
      interrupted: 0,
      notApplicable: 0,
      passed: 1,
      pending: 0,
      running: 0,
      skippedAfterTimeout: 0,
      skippedPrerequisite: 0,
      timedOut: 0,
      total: 1,
    },
    checks: [releaseCheck()],
    ...overrides,
  };
}

function releaseArtifact(
  overrides: Partial<EvidenceArtifactReference> = {},
): EvidenceArtifactReference {
  return {
    label: "Journey",
    path: "ci-reports/journeys/report.json",
    required: true,
    sourcePath: "ci-reports/journeys/report.json",
    copiedPath: null,
    copyError: null,
    exists: false,
    fresh: false,
    modifiedAt: null,
    ...overrides,
  };
}

describe("test evidence CI bundle", () => {
  it("models invalid CLI arguments as stable verification Problems", () => {
    for (const args of [[], ["--input"], ["--output"], ["--unknown"]]) {
      expect(() => parseArguments(args)).toThrow(VerificationProblem);
    }
    try {
      parseArguments(["--unknown"]);
      throw new Error("Expected parseArguments to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "UNKNOWN_TEST_EVIDENCE_ARGUMENT", category: "input" });
    }
  });
  it("normalizes record arrays and existing bundles without changing their records", () => {
    const evidence = normalizeTestEvidenceInput(releaseReport(), "release.json")[0];
    if (!evidence) throw new Error("Expected normalized evidence");
    expect(normalizeTestEvidenceInput(evidence, "record.json")).toEqual([evidence]);
    expect(normalizeTestEvidenceInput([evidence], "records.json")).toEqual([evidence]);
    expect(
      normalizeTestEvidenceInput(
        {
          schemaVersion: "croco.test-evidence/v1",
          status: "passed",
          missingArtifacts: [],
          summary: { failed: 0, flaky: 0, passed: 1, skipped: 0, total: 1 },
          records: [evidence],
        },
        "bundle.json",
      ),
    ).toEqual([evidence]);
  });

  it("normalizes verification results without rerunning their commands", () => {
    const rootDirectory = temporaryDirectory();
    mkdirSync(join(rootDirectory, "ci-reports/release"), { recursive: true });
    writeFileSync(
      join(rootDirectory, "ci-reports/release/spine-evidence.json"),
      JSON.stringify(
        releaseReport({
          checks: [
            releaseCheck({
              id: "package-tests",
              label: "Package tests",
              category: "quality",
              command: ["pnpm", "test"],
              durationMs: 12,
              status: "passed",
              artifacts: [],
            }),
          ],
        }),
      ),
    );
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["ci-reports/release/spine-evidence.json"],
      outputDirectory: "ci-reports/test-evidence",
      rootDirectory,
    });
    expect(bundle.status).toBe("passed");
    expect(bundle.records[0]).toMatchObject({
      id: "verification/spine/package-tests",
      observed: { contractIds: ["package-tests"] },
      replay: { command: "pnpm test" },
    });
    expect(existsSync(join(rootDirectory, "ci-reports/test-evidence/bundle.json"))).toBe(true);
    expect(
      readFileSync(join(rootDirectory, "ci-reports/test-evidence/summary.md"), "utf8"),
    ).toContain("verification/spine/package-tests");
  });

  it("writes a failed bundle with explicit evidence when a required input is missing", () => {
    const rootDirectory = temporaryDirectory();
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["ci-reports/missing.json"],
      outputDirectory: "ci-reports/test-evidence",
      rootDirectory,
    });
    expect(bundle.status).toBe("failed");
    expect(bundle.missingArtifacts).toEqual([
      {
        path: "ci-reports/missing.json",
        recordId: "missing-input/ci-reports/missing.json",
        required: true,
      },
    ]);
    expect(bundle.records[0]?.diagnostics[0]?.code).toBe("CROCO_TEST_EVIDENCE_INPUT_MISSING");
  });

  it("preserves required missing artifacts from an existing verification report", () => {
    const rootDirectory = temporaryDirectory();
    mkdirSync(join(rootDirectory, "ci-reports/release"), { recursive: true });
    writeFileSync(
      join(rootDirectory, "ci-reports/release/spine-evidence.json"),
      JSON.stringify(
        releaseReport({
          status: "failed",
          checks: [
            releaseCheck({
              id: "journey",
              label: "Browser journey",
              command: ["pnpm", "test:journey"],
              status: "failed",
              artifacts: [releaseArtifact()],
            }),
          ],
        }),
      ),
    );
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["ci-reports/release/spine-evidence.json"],
      outputDirectory: "ci-reports/test-evidence",
      rootDirectory,
    });
    expect(bundle.missingArtifacts).toContainEqual({
      path: "ci-reports/journeys/report.json",
      recordId: "verification/spine/journey",
      required: true,
    });
  });

  it("does not require artifacts from verification checks that were not applicable", () => {
    const rootDirectory = temporaryDirectory();
    mkdirSync(join(rootDirectory, "ci-reports/release"), { recursive: true });
    writeFileSync(
      join(rootDirectory, "ci-reports/release/spine-evidence.json"),
      JSON.stringify(
        releaseReport({
          profile: "publish",
          checks: [
            releaseCheck({
              id: "alpha-release-smoke",
              label: "Alpha release smoke",
              status: "not_applicable",
              artifacts: [releaseArtifact({ path: "ci-reports/release/alpha-release-smoke.md" })],
            }),
          ],
        }),
      ),
    );
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["ci-reports/release/spine-evidence.json"],
      outputDirectory: "ci-reports/test-evidence",
      rootDirectory,
    });
    expect(bundle.status).toBe("passed");
    expect(bundle.missingArtifacts).toEqual([]);
    expect(bundle.records[0]).toMatchObject({
      id: "verification/publish/alpha-release-smoke",
      outcome: "skipped",
      attachments: [
        {
          path: "ci-reports/release/spine-evidence.json",
          schemaVersion: "croco.release-spine-evidence/v1",
        },
      ],
    });
  });

  it.each([
    ["unrelated version", { ...releaseReport(), schemaVersion: "unrelated/v99" }],
    ["missing version", { ...releaseReport(), schemaVersion: undefined }],
    [
      "attachment tag as source version",
      { ...releaseReport(), schemaVersion: "croco.release-spine-evidence/v1" },
    ],
    ["checks only", { checks: [] }],
    ["missing profile", { ...releaseReport(), profile: undefined }],
    ["coerced profile", { ...releaseReport(), profile: ["spine"] }],
    ["unknown profile", { ...releaseReport(), profile: "other" }],
    ["missing provenance", { ...releaseReport(), provenance: undefined }],
    ["missing run identity", { ...releaseReport(), provenance: { commitSha: "abc123" } }],
    [
      "invalid verification identity",
      {
        ...releaseReport(),
        provenance: { ...releaseReport().provenance, verificationIdentity: {} },
      },
    ],
    ["missing report status", { ...releaseReport(), status: undefined }],
    ["missing summary", { ...releaseReport(), summary: undefined }],
    ["null check", releaseReport({ checks: [null as never] })],
    ["missing check id", releaseReport({ checks: [releaseCheck({ id: undefined as never })] })],
    ["missing command", releaseReport({ checks: [releaseCheck({ command: undefined as never })] })],
    ["empty command", releaseReport({ checks: [releaseCheck({ command: [] })] })],
    ["empty executable", releaseReport({ checks: [releaseCheck({ command: ["", "arg"] })] })],
    ["non-string command", releaseReport({ checks: [releaseCheck({ command: [42 as never] })] })],
    [
      "unknown check status",
      releaseReport({ checks: [releaseCheck({ status: "success" as never })] }),
    ],
    ["negative duration", releaseReport({ checks: [releaseCheck({ durationMs: -1 })] })],
    [
      "malformed artifact",
      releaseReport({
        checks: [releaseCheck({ artifacts: [releaseArtifact({ required: "yes" as never })] })],
      }),
    ],
  ])("rejects %s as invalid input rather than verification evidence", (_name, report) => {
    const rootDirectory = temporaryDirectory();
    writeFileSync(join(rootDirectory, "input.json"), JSON.stringify(report));
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["input.json"],
      outputDirectory: "output",
      rootDirectory,
    });
    expect(bundle.status).toBe("failed");
    expect(bundle.summary).toMatchObject({ failed: 1, passed: 0, skipped: 0, total: 1 });
    expect(bundle.records[0]).toMatchObject({
      id: "invalid-input/input.json",
      diagnostics: [{ code: "CROCO_TEST_EVIDENCE_INPUT_INVALID" }],
    });
    expect(JSON.parse(readFileSync(join(rootDirectory, "output/bundle.json"), "utf8")).status).toBe(
      "failed",
    );
    expect(readFileSync(join(rootDirectory, "output/summary.md"), "utf8")).toContain(
      "invalid-input/input.json",
    );
  });

  it("retains the existing empty bundle policy for a valid empty v1 report", () => {
    expect(
      normalizeTestEvidenceInput(
        releaseReport({
          checks: [],
          summary: {
            failed: 0,
            interrupted: 0,
            notApplicable: 0,
            passed: 0,
            pending: 0,
            running: 0,
            skippedAfterTimeout: 0,
            skippedPrerequisite: 0,
            timedOut: 0,
            total: 0,
          },
        }),
        "empty.json",
      ),
    ).toEqual([]);
  });

  it.each([
    "pending",
    "running",
    "failed",
    "timed_out",
    "interrupted",
    "skipped_after_timeout",
    "skipped_prerequisite",
  ] as const)("keeps a known %s check as failed evidence", (status) => {
    const records = normalizeTestEvidenceInput(
      releaseReport({ checks: [releaseCheck({ status })] }),
      "release.json",
    );
    expect(records[0]).toMatchObject({ outcome: "failed", observed: { contractIds: [] } });
  });

  it("consumes an actual v1 report with its command, source artifact and provenance intact", async () => {
    const rootDirectory = temporaryDirectory();
    mkdirSync(join(rootDirectory, "source"));
    const proofCommand =
      "require('node:fs').writeFileSync('source/proof.json', JSON.stringify(process.argv.slice(1)))";
    const report = await runReleaseSpineEvidence({
      rootDir: rootDirectory,
      outputDir: join(rootDirectory, "release"),
      totalTimeoutMs: 10000,
      profile: "repo",
      commands: [
        {
          ...getVerificationCommand("ci-executables"),
          id: "proof",
          label: "Proof",
          command: [process.execPath, "-e", proofCommand, "", " "],
          timeoutMs: 1000,
          artifacts: [{ label: "Proof", path: "source/proof.json", required: true }],
        },
      ],
    });
    expect(report.status).toBe("passed");
    expect(JSON.parse(readFileSync(join(rootDirectory, "source/proof.json"), "utf8"))).toEqual([
      "",
      " ",
    ]);
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["release/spine-evidence.json"],
      outputDirectory: "output",
      rootDirectory,
    });
    expect(bundle.status).toBe("passed");
    expect(bundle.records[0]).toMatchObject({
      id: "verification/repo/proof",
      observed: { contractIds: ["proof"] },
      replay: { command: `${process.execPath} -e ${proofCommand}   ` },
      attachments: [
        { path: "release/spine-evidence.json", schemaVersion: "croco.release-spine-evidence/v1" },
        { path: "source/proof.json" },
      ],
      metadata: {
        category: "security",
        sourceSchemaVersion: 1,
        sourceProvenance: report.provenance,
        commitSha: report.provenance.commitSha,
      },
    });
    expect(report.checks[0]?.artifacts[0]?.copiedPath).toBeTruthy();
    expect(
      normalizeTestEvidenceInput(releaseReport(), "release.json")[0]?.metadata?.sourceProvenance,
    ).toEqual(releaseReport().provenance);
  });

  it("always writes failed JSON and Markdown outputs for malformed input", () => {
    const rootDirectory = temporaryDirectory();
    writeFileSync(join(rootDirectory, "malformed.json"), "{not-json");
    const bundle = writeTestEvidenceBundle({
      inputPaths: ["malformed.json"],
      outputDirectory: "ci-reports/test-evidence",
      rootDirectory,
    });
    expect(bundle.status).toBe("failed");
    expect(bundle.records[0]?.diagnostics[0]?.code).toBe("CROCO_TEST_EVIDENCE_INPUT_INVALID");
    expect(bundle.records[0]?.diagnostics[0]?.recoveryAction).toContain("Cause:");
    expect(existsSync(join(rootDirectory, "ci-reports/test-evidence/bundle.json"))).toBe(true);
    expect(existsSync(join(rootDirectory, "ci-reports/test-evidence/summary.md"))).toBe(true);
  });
});

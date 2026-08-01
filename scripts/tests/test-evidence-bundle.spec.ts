import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  normalizeTestEvidenceInput,
  parseArguments,
  writeTestEvidenceBundle,
} from "../test-evidence-bundle.mts";
import { VerificationProblem } from "../verification-problem.mts";

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
    const evidence = normalizeTestEvidenceInput(
      {
        profile: "spine",
        checks: [{ id: "test", label: "Test", status: "passed" }],
      },
      "release.json",
    )[0];
    if (!evidence) throw new Error("Expected normalized evidence");
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
      JSON.stringify({
        profile: "spine",
        provenance: { commitSha: "abc123" },
        checks: [
          {
            id: "package-tests",
            label: "Package tests",
            category: "quality",
            command: ["pnpm", "test"],
            durationMs: 12,
            status: "passed",
            artifacts: [],
          },
        ],
      }),
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
      JSON.stringify({
        profile: "spine",
        checks: [
          {
            id: "journey",
            label: "Browser journey",
            command: ["pnpm", "test:journey"],
            status: "failed",
            artifacts: [
              {
                exists: false,
                path: "ci-reports/journeys/report.json",
                required: true,
                sourcePath: "ci-reports/journeys/report.json",
              },
            ],
          },
        ],
      }),
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
      JSON.stringify({
        profile: "publish",
        checks: [
          {
            id: "alpha-release-smoke",
            label: "Alpha release smoke",
            status: "not_applicable",
            artifacts: [
              {
                exists: false,
                path: "ci-reports/release/alpha-release-smoke.md",
                required: true,
              },
            ],
          },
        ],
      }),
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

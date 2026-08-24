import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createTestEvidenceRecord } from "./test-evidence-runtime.mts";
import { createTestLanePlan } from "./test-lane-runner.mts";
import { inventoryDigest, readTestInventory } from "./test-inventory.mts";

type FullSuiteLaneReport = {
  readonly schemaVersion: "croco.test-lane-report/v2";
  readonly inventoryDigest: string;
  readonly lane: "fast";
  readonly status: "passed" | "failed";
  readonly executedPaths: readonly string[];
  readonly skippedFiles: readonly unknown[];
  readonly commands: readonly {
    readonly owner: string;
    readonly cwd: string;
    readonly paths: readonly string[];
    readonly executedPaths: readonly string[];
    readonly skippedFiles: readonly unknown[];
    readonly status: "passed" | "failed";
    readonly exitCode: number;
    readonly executionState?: "executed" | "reused";
    readonly cacheHash?: string;
  }[];
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function assertChangedTestFullSuiteEvidence(
  report: FullSuiteLaneReport,
  rootDirectory = resolve(import.meta.dirname, ".."),
): void {
  const { inventory, diagnostics } = readTestInventory(
    resolve(rootDirectory, "test-inventory.json"),
  );
  if (diagnostics.length > 0) throw new Error("The test inventory is invalid.");
  if (
    report.schemaVersion !== "croco.test-lane-report/v2" ||
    report.lane !== "fast" ||
    report.status !== "passed" ||
    report.inventoryDigest !== inventoryDigest(inventory) ||
    !Array.isArray(report.skippedFiles) ||
    report.skippedFiles.length > 0
  ) {
    throw new Error("Changed-test full-suite evidence is failed, stale, or uses the wrong lane.");
  }
  const expectedPlan = createTestLanePlan(inventory, "fast");
  const expectedCommands = expectedPlan.map(({ owner, cwd, paths }) => ({ owner, cwd, paths }));
  const actualCommands = report.commands.map(({ owner, cwd, paths }) => ({ owner, cwd, paths }));
  if (JSON.stringify(actualCommands) !== JSON.stringify(expectedCommands)) {
    throw new Error(
      "Changed-test full-suite evidence does not cover the exact planned test tasks.",
    );
  }
  for (const command of report.commands) {
    if (
      command.status !== "passed" ||
      command.exitCode !== 0 ||
      JSON.stringify(command.executedPaths) !== JSON.stringify(command.paths) ||
      !Array.isArray(command.skippedFiles) ||
      command.skippedFiles.length > 0 ||
      !command.executionState ||
      (command.cwd !== "." && (!command.cacheHash || command.cacheHash.length === 0))
    ) {
      throw new Error(
        `Changed-test full-suite evidence is incomplete or unhashed for ${command.owner}.`,
      );
    }
  }
  const expectedPaths = inventory.tests
    .filter(({ lane }) => lane === "fast")
    .map(({ path }) => path)
    .sort(compareText);
  if (JSON.stringify(report.executedPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("Changed-test full-suite evidence does not cover every fast test path.");
  }
}

export function readChangedTestFullSuiteEvidence(
  path: string,
  rootDirectory = resolve(import.meta.dirname, ".."),
): FullSuiteLaneReport {
  const report = JSON.parse(
    readFileSync(resolve(rootDirectory, path), "utf8"),
  ) as FullSuiteLaneReport;
  assertChangedTestFullSuiteEvidence(report, rootDirectory);
  return report;
}

export function writeChangedTestFullSuiteStatus(
  exitCode: number,
  output: string,
  laneReportPath: string,
  rootDirectory = resolve(import.meta.dirname, ".."),
): void {
  const record = createTestEvidenceRecord({
    id: "croco.changed-test-full-suite-status",
    runner: "croco-verification",
    intent: { contractIds: [], description: "Cache-aware full-suite shadow execution completed." },
    observed: { contractIds: [] },
    fidelity: {
      boot: "application",
      dependency: "local-real",
      isolation: "commit",
      runtime: "node",
      validation: "production",
    },
    replay: { command: "pnpm test" },
    attempts: [{ attempt: 1, outcome: exitCode === 0 ? "passed" : "failed" }],
    diagnostics:
      exitCode === 0
        ? []
        : [
            {
              code: "CROCO_CHANGED_TEST_FULL_SUITE_FAILED",
              recoveryAction:
                "Inspect the cache-aware test-lane output; collection, transform, configuration, or test execution failed.",
            },
          ],
    resources: { leaks: [], status: "not-checked" },
  });
  const absolute = resolve(rootDirectory, output);
  mkdirSync(dirname(absolute), { recursive: true });
  if (exitCode !== 0) {
    writeFileSync(absolute, `${JSON.stringify([record], null, 2)}\n`);
    return;
  }

  const report = readChangedTestFullSuiteEvidence(laneReportPath, rootDirectory);
  const relativeReportPath = relative(
    rootDirectory,
    resolve(rootDirectory, laneReportPath),
  ).replaceAll("\\", "/");
  const completeness = createTestEvidenceRecord({
    id: "croco.changed-test-full-suite-completeness",
    runner: "croco-verification",
    intent: {
      contractIds: [],
      description: "Every full-suite test task and path has exact hash-matched execution evidence.",
    },
    observed: { contractIds: [] },
    fidelity: {
      boot: "application",
      dependency: "local-real",
      isolation: "commit",
      runtime: "node",
      validation: "production",
    },
    replay: { command: "pnpm test" },
    attempts: [{ attempt: 1, outcome: "passed" }],
    diagnostics: [],
    resources: { leaks: [], status: "not-checked" },
    attachments: [
      {
        kind: "report",
        path: relativeReportPath,
        schemaVersion: "croco.test-lane-report/v2",
      },
    ],
    metadata: {
      inventoryDigest: report.inventoryDigest,
      lane: report.lane,
      tasks: report.commands.map(
        ({ cacheHash, cwd, executedPaths, executionState, owner, paths }) => ({
          ...(cacheHash ? { cacheHash } : {}),
          cwd,
          executedPaths,
          executionState: executionState ?? "executed",
          owner,
          paths,
        }),
      ),
    },
  });
  writeFileSync(absolute, `${JSON.stringify([record, completeness], null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--check") {
    const laneReportPath = process.argv[3];
    if (!laneReportPath)
      throw new Error("Usage: changed-test-full-suite-status.mts --check <lane-report>");
    readChangedTestFullSuiteEvidence(laneReportPath);
  } else {
    const exitCode = Number(process.argv[2]);
    const output = process.argv[3];
    const laneReportPath = process.argv[4];
    if (!Number.isInteger(exitCode) || !output || !laneReportPath) {
      throw new Error(
        "Usage: changed-test-full-suite-status.mts <exit-code> <output> <lane-report>",
      );
    }
    writeChangedTestFullSuiteStatus(exitCode, output, laneReportPath);
  }
}

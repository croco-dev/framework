import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createTestEvidenceRecord, serializeTestEvidence } from "./test-evidence-runtime.mts";

export function writeChangedTestFullSuiteStatus(exitCode: number, output: string): void {
  const record = createTestEvidenceRecord({
    id: "croco.changed-test-full-suite-status",
    runner: "croco-verification",
    intent: { contractIds: [], description: "Uncached full-suite shadow execution completed." },
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
                "Inspect the uncached Turbo test output; collection, transform, configuration, or test execution failed.",
            },
          ],
    resources: { leaks: [], status: "not-checked" },
  });
  const absolute = resolve(output);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, serializeTestEvidence(record));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const exitCode = Number(process.argv[2]);
  const output = process.argv[3];
  if (!Number.isInteger(exitCode) || !output) {
    throw new Error("Usage: changed-test-full-suite-status.mts <exit-code> <output>");
  }
  writeChangedTestFullSuiteStatus(exitCode, output);
}

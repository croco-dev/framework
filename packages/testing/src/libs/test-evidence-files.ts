import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { serializeTestEvidence, TestEvidenceContractError } from "./test-evidence.mjs";
import type { TestEvidenceRecord } from "./test-evidence.mjs";

export type TestEvidenceFileWriterOptions = {
  readonly outputDirectory?: string;
  readonly runId?: string;
};

export type TestEvidenceFileWriter = ((record: TestEvidenceRecord) => void) & {
  readonly runId: string;
  readonly outputDirectory: string;
};

export function createTestEvidenceFileWriter(
  options: TestEvidenceFileWriterOptions = {},
): TestEvidenceFileWriter {
  const runId = options.runId ?? process.env["CROCO_TEST_EVIDENCE_RUN_ID"] ?? randomUUID();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(runId)) {
    throw new TestEvidenceContractError("Evidence runId must be a non-empty path-safe identifier.");
  }
  const outputDirectory = resolve(
    options.outputDirectory ??
      process.env["CROCO_TEST_EVIDENCE_DIR"] ??
      "ci-reports/test-evidence/records",
    "runs",
    runId,
  );
  const write = (record: TestEvidenceRecord): void => {
    mkdirSync(outputDirectory, { recursive: true });
    const identity = `${record.runner}\u0000${record.id}\u0000${record.replay.command}`;
    const slug =
      `${record.runner}-${record.id}`.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") ||
      "evidence";
    const digest = createHash("sha256").update(identity).digest("hex").slice(0, 12);
    const outputPath = resolve(outputDirectory, `${slug}-${digest}.json`);
    const serialized = serializeTestEvidence(record);
    try {
      writeFileSync(outputPath, serialized, { flag: "wx" });
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      if (readFileSync(outputPath, "utf8") !== serialized) {
        throw new TestEvidenceContractError(
          `Evidence fragment collision at '${outputPath}' for '${record.id}'. Use unique runner IDs or replay commands.`,
          error,
        );
      }
    }
  };
  return Object.assign(write, { runId, outputDirectory });
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

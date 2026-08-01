import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { serializeTestEvidence, TestEvidenceContractError } from "./test-evidence.mjs";
import type { TestEvidenceRecord } from "./test-evidence.mjs";

export type TestEvidenceFileWriterOptions = {
  readonly outputDirectory?: string;
};

export function createTestEvidenceFileWriter(
  options: TestEvidenceFileWriterOptions = {},
): (record: TestEvidenceRecord) => void {
  const outputDirectory = resolve(
    options.outputDirectory ??
      process.env["CROCO_TEST_EVIDENCE_DIR"] ??
      "ci-reports/test-evidence/records",
  );
  return (record) => {
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
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

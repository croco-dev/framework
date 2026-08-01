import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { VerificationProblem } from "./verification-problem.mts";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problemsCoreEntry = resolve(rootDirectory, "packages/problems-core/dist/index.mjs");

if (!existsSync(problemsCoreEntry)) {
  try {
    execFileSync("pnpm", ["--filter", "@croco/problems-core", "build"], {
      cwd: rootDirectory,
      stdio: "inherit",
    });
  } catch {
    throw new VerificationProblem(
      "TEST_EVIDENCE_RUNTIME_BOOTSTRAP_FAILED",
      "configuration",
      "Unable to build @croco/problems-core before loading the executable test-evidence runtime.",
    );
  }
}

const runtime = await import("../packages/testing/src/libs/test-evidence.mts");

export const assertTestEvidenceBundle = runtime.assertTestEvidenceBundle;
export const assertTestEvidenceRecord = runtime.assertTestEvidenceRecord;
export const createTestEvidenceBundle = runtime.createTestEvidenceBundle;
export const createTestEvidenceRecord = runtime.createTestEvidenceRecord;
export const renderTestEvidenceMarkdown = runtime.renderTestEvidenceMarkdown;
export const serializeTestEvidence = runtime.serializeTestEvidence;

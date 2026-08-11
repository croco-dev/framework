import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { writeChangedTestFullSuiteStatus } from "../changed-test-full-suite-status.mts";

describe("changed-test-full-suite-status", () => {
  it("records collection and configuration failures as explicit failed evidence", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "croco-changed-test-status-"));
    try {
      const output = resolve(directory, "status.json");
      writeChangedTestFullSuiteStatus(1, output);
      expect(JSON.parse(readFileSync(output, "utf8"))).toMatchObject({
        id: "croco.changed-test-full-suite-status",
        outcome: "failed",
        diagnostics: [{ code: "CROCO_CHANGED_TEST_FULL_SUITE_FAILED" }],
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

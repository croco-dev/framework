import { describe, expect, it } from "vitest";

import { validateTestLaneEvidence } from "../test-lane-evidence-check.mts";
import { inventoryDigest, readTestInventory } from "../test-inventory.mts";

const REQUIRED_PATH = "scripts/tests/verification-manifest.spec.ts";

function report(overrides: Record<string, unknown> = {}): unknown {
  const digest = inventoryDigest(readTestInventory().inventory);
  return {
    schemaVersion: "croco.test-lane-report/v1",
    inventoryVersion: 1,
    inventoryDigest: digest,
    lane: "fast",
    allowLive: false,
    selectedOwners: ["repo:ci"],
    status: "passed",
    executedPaths: [REQUIRED_PATH],
    diagnostics: [],
    commands: [
      {
        owner: "repo:ci",
        cwd: ".",
        paths: [REQUIRED_PATH],
        command: ["pnpm", "exec", "vitest", "run", REQUIRED_PATH],
        status: "passed",
        exitCode: 0,
        durationMs: 1,
        executedPaths: [REQUIRED_PATH],
        executionState: "executed",
      },
    ],
    ...overrides,
  };
}

describe("test lane evidence check", () => {
  it("accepts a current exact lane report that covers every required path", () => {
    expect(
      validateTestLaneEvidence(report(), { lane: "fast", requiredPaths: [REQUIRED_PATH] }).lane,
    ).toBe("fast");
  });

  it("rejects missing paths, stale inventories, and the wrong lane", () => {
    expect(() =>
      validateTestLaneEvidence(report(), {
        lane: "fast",
        requiredPaths: ["scripts/tests/missing.spec.ts"],
      }),
    ).toThrow("missing required paths");
    expect(() =>
      validateTestLaneEvidence(report({ inventoryDigest: "stale" }), {
        lane: "fast",
        requiredPaths: [REQUIRED_PATH],
      }),
    ).toThrow("current inventory");
    expect(() =>
      validateTestLaneEvidence(report(), {
        lane: "integration",
        requiredPaths: [REQUIRED_PATH],
      }),
    ).toThrow("Expected integration");
  });
});

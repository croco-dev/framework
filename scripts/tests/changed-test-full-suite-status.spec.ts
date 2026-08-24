import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertChangedTestFullSuiteEvidence,
  writeChangedTestFullSuiteStatus,
} from "../changed-test-full-suite-status.mts";
import { inventoryDigest } from "../test-inventory.mts";
import type { TestInventory } from "../test-inventory.mts";

const inventory: TestInventory = {
  version: 1,
  exceptions: [],
  tests: [
    { path: "packages/a/src/tests/A.spec.ts", lane: "fast", qualifiers: [], owner: "@croco/a" },
  ],
};

function laneReport(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "croco.test-lane-report/v2" as const,
    inventoryDigest: inventoryDigest(inventory),
    lane: "fast" as const,
    status: "passed" as const,
    executedPaths: ["packages/a/src/tests/A.spec.ts"],
    skippedFiles: [],
    commands: [
      {
        owner: "@croco/a",
        cwd: "packages/a",
        paths: ["src/tests/A.spec.ts"],
        command: ["pnpm", "run", "test"],
        durationMs: 1,
        exitCode: 0,
        status: "passed",
        cacheStatus: "hit",
        cacheHash: "task-hash",
        executionState: "reused",
        executedPaths: ["src/tests/A.spec.ts"],
        skippedFiles: [],
      },
    ],
    allowLive: false,
    selectedOwners: [],
    diagnostics: [],
    ...overrides,
  };
}

function fixtureRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "croco-changed-test-status-"));
  mkdirSync(resolve(root, "packages/a"), { recursive: true });
  writeFileSync(resolve(root, "test-inventory.json"), `${JSON.stringify(inventory)}\n`);
  return root;
}

describe("changed-test-full-suite-status", () => {
  it("records collection and configuration failures as explicit failed evidence", () => {
    const directory = fixtureRoot();
    try {
      const output = resolve(directory, "status.json");
      const report = resolve(directory, "lane.json");
      writeFileSync(report, `${JSON.stringify(laneReport())}\n`);
      writeChangedTestFullSuiteStatus(1, output, report, directory);
      const records = JSON.parse(readFileSync(output, "utf8")) as Record<string, unknown>[];
      expect(records.find(({ id }) => id === "croco.changed-test-full-suite-status")).toMatchObject(
        {
          outcome: "failed",
          diagnostics: [{ code: "CROCO_CHANGED_TEST_FULL_SUITE_FAILED" }],
        },
      );
      expect(records.find(({ id }) => id === "croco.changed-test-full-suite-completeness")).toBe(
        undefined,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("persists failed status evidence even when the failed lane report is incomplete", () => {
    const directory = fixtureRoot();
    try {
      const output = resolve(directory, "status.json");
      const report = resolve(directory, "lane.json");
      writeFileSync(report, `${JSON.stringify(laneReport({ status: "failed", commands: [] }))}\n`);

      expect(() => writeChangedTestFullSuiteStatus(1, output, report, directory)).not.toThrow();
      expect(JSON.parse(readFileSync(output, "utf8"))).toEqual([
        expect.objectContaining({
          id: "croco.changed-test-full-suite-status",
          outcome: "failed",
          diagnostics: [
            { code: "CROCO_CHANGED_TEST_FULL_SUITE_FAILED", recoveryAction: expect.any(String) },
          ],
        }),
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("emits completeness only after successful lane evidence is validated", () => {
    const directory = fixtureRoot();
    try {
      const output = resolve(directory, "status.json");
      const report = resolve(directory, "lane.json");
      writeFileSync(report, `${JSON.stringify(laneReport())}\n`);
      writeChangedTestFullSuiteStatus(0, output, report, directory);

      const records = JSON.parse(readFileSync(output, "utf8")) as Record<string, unknown>[];
      expect(
        records.find(({ id }) => id === "croco.changed-test-full-suite-completeness"),
      ).toMatchObject({
        outcome: "passed",
        metadata: {
          inventoryDigest: inventoryDigest(inventory),
          tasks: [expect.objectContaining({ cacheHash: "task-hash" })],
        },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a Turbo cache hit whose restored evidence is missing a planned path", () => {
    const directory = fixtureRoot();
    try {
      const report = laneReport({
        executedPaths: [],
        commands: [
          {
            ...laneReport().commands[0],
            executedPaths: [],
          },
        ],
      });
      expect(() => assertChangedTestFullSuiteEvidence(report, directory)).toThrow(
        "incomplete or unhashed",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects exact-looking cached paths without the current Turbo task hash", () => {
    const directory = fixtureRoot();
    try {
      const command = { ...laneReport().commands[0] };
      delete (command as { cacheHash?: string }).cacheHash;
      expect(() =>
        assertChangedTestFullSuiteEvidence(laneReport({ commands: [command] }), directory),
      ).toThrow("incomplete or unhashed");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects a report that exposes skipped assertion evidence", () => {
    const directory = fixtureRoot();
    try {
      const skippedFile = {
        path: "src/tests/A.spec.ts",
        status: "partially-executed",
        passedAssertions: 1,
        skippedAssertions: [{ name: "requires service credentials", status: "skipped" }],
      };
      const report = laneReport({
        status: "failed",
        executedPaths: [],
        skippedFiles: [{ ...skippedFile, path: "packages/a/src/tests/A.spec.ts" }],
        commands: [
          {
            ...laneReport().commands[0],
            status: "failed",
            executedPaths: [],
            skippedFiles: [skippedFile],
          },
        ],
      });

      expect(() => assertChangedTestFullSuiteEvidence(report, directory)).toThrow(
        "failed, stale, or uses the wrong lane",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

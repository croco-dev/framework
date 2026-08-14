#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createTestInventoryEvidenceReport,
  inventoryDigest,
  readTestInventory,
  TEST_LANES,
  TEST_PROFILES,
  validateGeneratedMaterialization,
} from "./test-inventory.mts";
import type { TestLane, TestProfile } from "./test-inventory.mts";
import type {
  MaterializationEvidence,
  TestInventory,
  TestInventoryDiagnostic,
  TestInventoryEvidenceReport,
} from "./test-inventory.mts";

export type LaneReport = {
  readonly schemaVersion: "croco.test-lane-report/v1";
  readonly inventoryVersion: 1;
  readonly inventoryDigest: string;
  readonly lane: Exclude<TestLane, "generated-app">;
  readonly allowLive: boolean;
  readonly selectedOwners: readonly string[];
  readonly status: "passed" | "failed";
  readonly executedPaths: readonly string[];
  readonly diagnostics: readonly { readonly code: string; readonly message: string }[];
  readonly commands: readonly {
    readonly owner: string;
    readonly cwd: string;
    readonly paths: readonly string[];
    readonly command: readonly string[];
    readonly status: "passed" | "failed";
    readonly exitCode: number;
    readonly durationMs: number;
    readonly cacheStatus?: "hit" | "miss";
    readonly executedPaths: readonly string[];
    readonly executionState?: "executed" | "reused";
    readonly cacheHash?: string;
  }[];
};

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

const MATERIALIZATION_EVIDENCE_FIELDS = [
  "sourcePath",
  "sourceDigest",
  "generatedPath",
  "generatedDigest",
  "inventoryDigest",
  "commandId",
] as const satisfies readonly (keyof MaterializationEvidence)[];

export function assertMaterializationEvidence(
  value: unknown,
): asserts value is readonly MaterializationEvidence[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry) =>
        Boolean(entry) &&
        typeof entry === "object" &&
        MATERIALIZATION_EVIDENCE_FIELDS.every((field) => {
          const fieldValue = (entry as Record<string, unknown>)[field];
          return typeof fieldValue === "string" && fieldValue.length > 0;
        }),
    )
  ) {
    throw new Error("Generated materialization evidence has an invalid report shape");
  }
}

export function assertLaneReportShape(value: unknown): asserts value is LaneReport {
  if (!value || typeof value !== "object")
    throw new Error("Test lane evidence has an invalid report shape");
  const report = value as Record<string, unknown>;
  if (
    report.schemaVersion !== "croco.test-lane-report/v1" ||
    report.inventoryVersion !== 1 ||
    typeof report.inventoryDigest !== "string" ||
    !TEST_LANES.includes(report.lane as TestLane) ||
    report.lane === "generated-app" ||
    typeof report.allowLive !== "boolean" ||
    !isStringArray(report.selectedOwners) ||
    (report.status !== "passed" && report.status !== "failed") ||
    !isStringArray(report.executedPaths) ||
    !Array.isArray(report.diagnostics) ||
    !report.diagnostics.every(
      (diagnostic) =>
        Boolean(diagnostic) &&
        typeof diagnostic === "object" &&
        typeof (diagnostic as Record<string, unknown>).code === "string" &&
        typeof (diagnostic as Record<string, unknown>).message === "string",
    ) ||
    !Array.isArray(report.commands) ||
    report.commands.length === 0
  ) {
    throw new Error("Test lane evidence has an invalid report shape");
  }

  for (const value of report.commands) {
    if (!value || typeof value !== "object") {
      throw new Error("Test lane evidence has an invalid command result");
    }
    const command = value as Record<string, unknown>;
    if (
      typeof command.owner !== "string" ||
      typeof command.cwd !== "string" ||
      !isStringArray(command.paths) ||
      command.paths.length === 0 ||
      !isStringArray(command.command) ||
      command.command.length === 0 ||
      (command.status !== "passed" && command.status !== "failed") ||
      typeof command.exitCode !== "number" ||
      !Number.isInteger(command.exitCode) ||
      typeof command.durationMs !== "number" ||
      !Number.isFinite(command.durationMs) ||
      command.durationMs < 0 ||
      (command.cacheStatus !== undefined &&
        command.cacheStatus !== "hit" &&
        command.cacheStatus !== "miss") ||
      !isStringArray(command.executedPaths) ||
      command.executedPaths.some((path) => !(command.paths as readonly string[]).includes(path)) ||
      (command.executionState !== "executed" && command.executionState !== "reused") ||
      ((command.executionState === "reused" || command.cacheHash !== undefined) &&
        (typeof command.cacheHash !== "string" || command.cacheHash.length === 0))
    ) {
      throw new Error("Test lane evidence has an invalid command result");
    }
    if (
      (command.status === "passed" &&
        (command.exitCode !== 0 ||
          JSON.stringify(command.executedPaths) !== JSON.stringify(command.paths))) ||
      (command.status === "failed" && command.exitCode === 0)
    ) {
      throw new Error("Test lane evidence has an invalid command result");
    }
  }

  const executedPaths = (report.commands as LaneReport["commands"])
    .flatMap(({ cwd, executedPaths }) =>
      executedPaths.map((path) => (cwd === "." ? path : `${cwd}/${path}`)),
    )
    .sort();
  if (JSON.stringify(report.executedPaths) !== JSON.stringify(executedPaths)) {
    throw new Error("Test lane evidence has inconsistent executed paths");
  }
  const commands = report.commands as LaneReport["commands"];
  const diagnostics = report.diagnostics as LaneReport["diagnostics"];
  if (
    (report.status === "passed" &&
      (commands.some(({ status }) => status !== "passed") || diagnostics.length > 0)) ||
    (report.status === "failed" &&
      commands.every(({ status }) => status === "passed") &&
      diagnostics.length === 0)
  ) {
    throw new Error("Test lane evidence has an inconsistent status");
  }
}

export function assertLaneReport(value: unknown): asserts value is LaneReport {
  assertLaneReportShape(value);
  if (value.status !== "passed") {
    throw new Error("Test lane evidence is failed");
  }
}

export function reconcileTestEvidence(options: {
  readonly inventory: TestInventory;
  readonly profile: TestProfile;
  readonly reports: readonly LaneReport[];
  readonly affectedOwners?: readonly string[];
  readonly packagingOwners?: readonly string[];
  readonly generatedExecutedPaths?: readonly string[];
  readonly generatedDiagnostics?: readonly TestInventoryDiagnostic[];
}): TestInventoryEvidenceReport {
  const expectedDigest = inventoryDigest(options.inventory);
  for (const report of options.reports) {
    assertLaneReport(report);
    if (report.inventoryDigest !== expectedDigest) {
      throw new Error("Test lane evidence is failed or uses a stale inventory digest");
    }
  }
  const report = createTestInventoryEvidenceReport(options.inventory, options.profile, {
    affectedOwners: options.affectedOwners,
    packagingSurfaceOwners: options.packagingOwners,
    executedPaths: [
      ...options.reports.flatMap(({ executedPaths }) => executedPaths),
      ...(options.generatedExecutedPaths ?? []),
    ],
    enforce: true,
  });
  return {
    ...report,
    diagnostics: [...report.diagnostics, ...(options.generatedDiagnostics ?? [])],
  };
}

function values(args: readonly string[], name: string): readonly string[] {
  return args.flatMap((argument, index) =>
    argument === name && args[index + 1] ? [args[index + 1]] : [],
  );
}

function value(args: readonly string[], name: string): string | undefined {
  return values(args, name)[0];
}

export function parseTestEvidenceProfile(value: string | undefined): TestProfile {
  if (!value || !TEST_PROFILES.includes(value as TestProfile)) {
    throw new Error(`--profile requires one of: ${TEST_PROFILES.join(", ")}`);
  }
  return value as TestProfile;
}

export function requiredGeneratedSourcePaths(
  args: readonly string[],
): ReadonlySet<string> | undefined {
  const paths = values(args, "--required-generated-path");
  return paths.length > 0 ? new Set(paths) : undefined;
}

function main(args: readonly string[]): number {
  const root = resolve(import.meta.dirname, "..");
  const profile = parseTestEvidenceProfile(value(args, "--profile"));
  const output = value(args, "--output");
  if (!output) throw new Error("--output is required");
  const { inventory, diagnostics } = readTestInventory(resolve(root, "test-inventory.json"));
  if (diagnostics.length > 0) throw new Error(JSON.stringify(diagnostics));
  const reports = values(args, "--lane-report").map((path) => {
    const report: unknown = JSON.parse(readFileSync(resolve(root, path), "utf8"));
    assertLaneReport(report);
    return report;
  });
  const materializationPath = value(args, "--materialization-evidence");
  const generatedRoot = value(args, "--generated-root");
  if ((materializationPath === undefined) !== (generatedRoot === undefined)) {
    throw new Error("--materialization-evidence and --generated-root must be used together");
  }
  let materializationEvidence: readonly MaterializationEvidence[] | undefined;
  if (materializationPath) {
    const parsedMaterializationEvidence: unknown = JSON.parse(
      readFileSync(resolve(root, materializationPath), "utf8"),
    );
    assertMaterializationEvidence(parsedMaterializationEvidence);
    materializationEvidence = parsedMaterializationEvidence;
  }
  const requiredGeneratedPaths = requiredGeneratedSourcePaths(args);
  const generatedDiagnostics = materializationEvidence
    ? requiredGeneratedPaths
      ? validateGeneratedMaterialization(
          root,
          inventory,
          resolve(root, generatedRoot as string),
          materializationEvidence,
          requiredGeneratedPaths,
        )
      : validateGeneratedMaterialization(
          root,
          inventory,
          resolve(root, generatedRoot as string),
          materializationEvidence,
        )
    : [];
  const report = reconcileTestEvidence({
    inventory,
    profile,
    reports,
    affectedOwners: values(args, "--affected-owner"),
    packagingOwners: values(args, "--packaging-owner"),
    generatedExecutedPaths: materializationEvidence?.map(({ sourcePath }) => sourcePath),
    generatedDiagnostics,
  });
  const outputPath = resolve(root, output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  for (const diagnostic of report.diagnostics) {
    console.error(`${diagnostic.code}: ${diagnostic.message}`);
  }
  return report.diagnostics.length === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

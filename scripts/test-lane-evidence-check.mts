#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv } from "node:process";
import { pathToFileURL } from "node:url";

import { assertLaneReport } from "./test-evidence-reconcile.mts";
import { inventoryDigest, readTestInventory } from "./test-inventory.mts";
import type { LaneReport } from "./test-evidence-reconcile.mts";

type EvidenceCheckOptions = {
  readonly reportPath: string;
  readonly lane: LaneReport["lane"];
  readonly requiredPaths: readonly string[];
};

export function validateTestLaneEvidence(
  value: unknown,
  options: Omit<EvidenceCheckOptions, "reportPath">,
): LaneReport {
  assertLaneReport(value);
  const currentInventoryDigest = inventoryDigest(readTestInventory().inventory);
  if (value.inventoryDigest !== currentInventoryDigest) {
    throw new Error("Test lane evidence inventory digest does not match the current inventory");
  }
  if (value.lane !== options.lane) {
    throw new Error(`Expected ${options.lane} test lane evidence, received ${value.lane}`);
  }
  if (value.diagnostics.length > 0) {
    throw new Error("Test lane evidence contains diagnostics");
  }
  const executedPaths = new Set(value.executedPaths);
  const missingPaths = options.requiredPaths.filter((path) => !executedPaths.has(path));
  if (missingPaths.length > 0) {
    throw new Error(`Test lane evidence is missing required paths: ${missingPaths.join(", ")}`);
  }
  return value;
}

function parseArguments(args: readonly string[]): EvidenceCheckOptions {
  let reportPath: string | undefined;
  let lane: LaneReport["lane"] | undefined;
  const requiredPaths: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--report" && value) {
      reportPath = value;
      index += 1;
    } else if (argument === "--lane" && value) {
      if (!["fast", "integration", "published", "live"].includes(value)) {
        throw new Error(`Unsupported test lane: ${value}`);
      }
      lane = value as LaneReport["lane"];
      index += 1;
    } else if (argument === "--path" && value) {
      requiredPaths.push(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument ?? "<missing>"}`);
    }
  }
  if (!reportPath || !lane || requiredPaths.length === 0) {
    throw new Error("Usage: test-lane-evidence-check --report <path> --lane <lane> --path <path>");
  }
  return { reportPath, lane, requiredPaths };
}

function main(): void {
  const options = parseArguments(argv.slice(2));
  const report = JSON.parse(readFileSync(resolve(options.reportPath), "utf8")) as unknown;
  validateTestLaneEvidence(report, options);
  console.log(
    `[test-lane-evidence] ${options.lane} report covers ${options.requiredPaths.length} required paths`,
  );
}

const entry = argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) main();

#!/usr/bin/env node

import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, exit } from "node:process";
import { pathToFileURL } from "node:url";

import { parseSecurityPhysicalResults } from "./ci-synthesis-input.mts";
import { SECURITY_OWNERSHIP } from "./ci-verification-contract.mts";
import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";
import type { SynthesisSecurityResult } from "./ci-lane-evidence.mts";
import type { SecurityResultId } from "./ci-verification-contract.mts";

export type SecurityExitCodes = {
  readonly advisoryProductionAudit: number;
  readonly gitleaksAcceptanceSmoke: number;
  readonly blockingSecretScan: number;
};

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new VerificationProblem(
      "INVALID_SECURITY_EXIT_CODE",
      "input",
      `${field} requires a non-negative safe integer`,
    );
  }
  return value;
}

function exitCode(value: string | undefined, flag: string): number {
  if (!value || !/^\d+$/.test(value)) {
    throw new VerificationProblem(
      "INVALID_SECURITY_EXIT_CODE",
      "input",
      `${flag} requires a non-negative safe integer`,
    );
  }
  const parsed = Number(value);
  return nonNegativeInteger(parsed, flag);
}

function result(id: SecurityResultId, code: number): SynthesisSecurityResult {
  const ownership = SECURITY_OWNERSHIP.find((entry) => entry.id === id);
  if (!ownership || ownership.owner !== "coverage-security") {
    throw new VerificationProblem(
      "SECURITY_OWNERSHIP_MISMATCH",
      "contract",
      `${id} is not a physical coverage-security responsibility`,
    );
  }
  return {
    id,
    owner: ownership.owner,
    semantics: ownership.semantics,
    outcome: code === 0 ? "passed" : "failed",
    diagnostics: code === 0 ? [] : [`${id}:exit-code=${code}`],
  };
}

export function createSecurityPhysicalResults(
  codes: SecurityExitCodes,
): readonly SynthesisSecurityResult[] {
  return parseSecurityPhysicalResults([
    result(
      "advisory-production-audit",
      nonNegativeInteger(codes.advisoryProductionAudit, "advisoryProductionAudit"),
    ),
    result(
      "gitleaks-acceptance-smoke",
      nonNegativeInteger(codes.gitleaksAcceptanceSmoke, "gitleaksAcceptanceSmoke"),
    ),
    result(
      "blocking-secret-scan",
      nonNegativeInteger(codes.blockingSecretScan, "blockingSecretScan"),
    ),
  ]);
}

function value(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  const result = index === -1 ? undefined : args[index + 1];
  return result?.startsWith("-") ? undefined : result;
}

function main(args: readonly string[]): void {
  const output = value(args, "--output");
  if (!output) {
    throw new VerificationProblem("MISSING_SECURITY_OUTPUT", "input", "--output is required");
  }
  const results = createSecurityPhysicalResults({
    advisoryProductionAudit: exitCode(
      value(args, "--advisory-audit-exit-code"),
      "--advisory-audit-exit-code",
    ),
    gitleaksAcceptanceSmoke: exitCode(
      value(args, "--gitleaks-smoke-exit-code"),
      "--gitleaks-smoke-exit-code",
    ),
    blockingSecretScan: exitCode(value(args, "--secret-scan-exit-code"), "--secret-scan-exit-code"),
  });
  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(results, null, 2)}\n`);
    renameSync(temporaryPath, outputPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

if (import.meta.url === pathToFileURL(argv[1] ?? "").href) {
  try {
    main(argv.slice(2));
  } catch (error) {
    const problem =
      error instanceof VerificationProblem
        ? error
        : new VerificationProblem(
            "UNEXPECTED_FAILURE",
            "contract",
            error instanceof Error ? error.message : String(error),
          );
    process.stderr.write(
      `[ci-cacheable-security-evidence] ${formatVerificationProblem(problem)}\n`,
    );
    exit(1);
  }
}

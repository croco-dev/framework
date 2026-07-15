#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { formatVerificationProblem, VerificationProblem } from "./verification-problem.mts";

export type ProvenanceConfigInput = {
  readonly envValue: string | undefined;
  readonly npmValue: string;
};

function readNpmProvenance(): string {
  return execFileSync("npm", ["config", "get", "provenance"], { encoding: "utf8" }).trim();
}

export function assertProvenanceConfig(input: ProvenanceConfigInput): void {
  if (input.envValue !== "true") {
    throw new VerificationProblem(
      "PROVENANCE_ENV_DISABLED",
      "configuration",
      "NPM_CONFIG_PROVENANCE must be inherited as the exact value true.",
    );
  }
  if (input.npmValue !== "true") {
    throw new VerificationProblem(
      "PROVENANCE_NPM_CONFIG_DISABLED",
      "configuration",
      "npm config get provenance must resolve to true before publishing.",
    );
  }
}

export function verifyProvenanceConfig(): void {
  const npmValue = readNpmProvenance();
  console.log(`NPM_CONFIG_PROVENANCE: ${process.env.NPM_CONFIG_PROVENANCE ?? "undefined"}`);
  console.log(`npm provenance: ${npmValue}`);
  assertProvenanceConfig({ envValue: process.env.NPM_CONFIG_PROVENANCE, npmValue });
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  try {
    verifyProvenanceConfig();
  } catch (error) {
    console.error(`provenance-config-check: failed: ${formatVerificationProblem(error)}`);
    process.exitCode = 1;
  }
}

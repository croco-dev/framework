#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const REQUIRED_BRANCH_PROTECTION_CHECKS = [
  { context: "docs-sync-check", appId: 15368 },
  { context: "validate", appId: 15368 },
] as const;

export type RequiredStatusChecksProtection = {
  readonly strict?: unknown;
  readonly checks?: unknown;
};

type RequiredStatusCheck = {
  readonly context: string;
  readonly appId: number | null;
};

function requiredStatusChecks(
  protection: RequiredStatusChecksProtection,
): readonly RequiredStatusCheck[] {
  if (!Array.isArray(protection.checks)) return [];

  return protection.checks.flatMap((check) => {
    if (typeof check !== "object" || check === null || Array.isArray(check)) return [];
    const { context, app_id: appId } = check as Record<string, unknown>;
    if (typeof context !== "string" || (typeof appId !== "number" && appId !== null)) return [];
    return [{ context, appId }];
  });
}

export function findBranchProtectionPolicyViolations(
  protection: RequiredStatusChecksProtection,
): readonly string[] {
  const violations: string[] = [];
  if (protection.strict !== true) {
    violations.push("trunk required status checks must require the branch to be up to date");
  }

  const configuredChecks = requiredStatusChecks(protection);
  for (const required of REQUIRED_BRANCH_PROTECTION_CHECKS) {
    if (
      !configuredChecks.some(
        ({ context, appId }) => context === required.context && appId === required.appId,
      )
    ) {
      violations.push(
        `trunk must require the GitHub Actions ${required.context} check (app_id ${required.appId})`,
      );
    }
  }

  return violations;
}

function optionValue(arguments_: readonly string[], name: string): string | undefined {
  const index = arguments_.indexOf(name);
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function main(): void {
  const arguments_ = process.argv.slice(2);
  const repository = optionValue(arguments_, "--repo") ?? "croco-dev/framework";
  const branch = optionValue(arguments_, "--branch") ?? "trunk";
  const source = execFileSync(
    "gh",
    ["api", `repos/${repository}/branches/${branch}/protection/required_status_checks`],
    { encoding: "utf8" },
  );
  const protection = JSON.parse(source) as RequiredStatusChecksProtection;
  const violations = findBranchProtectionPolicyViolations(protection);
  if (violations.length > 0) {
    process.stderr.write(
      `branch-protection-policy: required status check policy drift detected.\n${violations.map((violation) => `- ${violation}`).join("\n")}\n`,
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `branch-protection-policy: ${repository} ${branch} requires current-base validation with app-bound docs-sync-check and validate checks.\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

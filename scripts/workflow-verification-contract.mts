import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createVerificationManifest } from "./verification-manifest.mts";

export type WorkflowCommandViolation = {
  readonly command: string;
  readonly line: number;
  readonly reason: string;
};

type RootScripts = Readonly<Record<string, string>>;

export const ACTIONS_ONLY_WORKFLOW_COMMAND_ALLOWLIST = [
  'node -e \'const fs = require("node:fs"); fs.writeFileSync("ci-reports/package-quality/spine-promotion-run.json", JSON.stringify({ commitSha: process.env.SPINE_PROMOTION_COMMIT_SHA, runId: process.env.SPINE_PROMOTION_RUN_ID, runAttempt: process.env.SPINE_PROMOTION_RUN_ATTEMPT, startedAt: new Date().toISOString() }, null, 2) + "\\n")\'',
  "node --experimental-strip-types scripts/verification-change-classifier.mts",
  "node --experimental-strip-types scripts/release-spine-evidence.mts",
  "pnpm install --frozen-lockfile",
  "pnpm audit:prod",
  "pnpm create-croco-app:smoke -- --tier ecosystem-advisory",
  "pnpm verify:publish",
  'docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.23.0@sha256:b4b81841085b4060054a71155500a340e3d2e2a5995c186546649e3efd80b84e detect',
] as const;

function splitShellCommands(command: string): readonly string[] {
  const segments: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = 0; index < command.length; index++) {
    const character = command[index] ?? "";
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      current += character;
      escaped = true;
      continue;
    }
    if ((character === "'" || character === '"') && (!quote || quote === character)) {
      quote = quote ? null : character;
      current += character;
      continue;
    }
    const pair = command.slice(index, index + 2);
    if (!quote && (pair === "&&" || pair === "||")) {
      if (current.trim()) segments.push(current.trim());
      current = "";
      index++;
      continue;
    }
    if (!quote && character === ";") {
      if (current.trim()) segments.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  if (current.trim()) segments.push(current.trim());
  return segments;
}

function normalizeInvocation(command: string): string {
  return command
    .replace(/^if\s+(?:!\s+)?/, "")
    .replace(/^(?:(?:then|else|do|command|env)\s+)+/, "")
    .replace(/^(?:[A-Z_][A-Z0-9_]*=\S+\s+)+/, "")
    .replace(/^pnpm\s+run\s+/, "pnpm ")
    .trim();
}

function matchesArgvPrefix(command: string, allowed: string): boolean {
  return command === allowed || command.startsWith(`${allowed} `);
}

function readRootScripts(rootDir: string): RootScripts {
  const packageJson = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")) as {
    readonly scripts?: RootScripts;
  };
  return packageJson.scripts ?? {};
}

function manifestArgvKeys(): readonly string[] {
  return createVerificationManifest("publish").map(({ command }) => command.join(" "));
}

function manifestOwnedAliases(rootDir: string): ReadonlySet<string> {
  const fingerprints = manifestArgvKeys();
  return new Set(
    Object.entries(readRootScripts(rootDir))
      .filter(
        ([, command]) =>
          command.includes("scripts/verification-command.mts --id ") ||
          fingerprints.some((fingerprint) => command.includes(fingerprint)),
      )
      .map(([alias]) => alias),
  );
}

function runCommands(
  workflow: string,
): readonly { readonly command: string; readonly line: number }[] {
  const lines = workflow.split("\n");
  const commands: { command: string; line: number }[] = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index]?.match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1]?.length ?? 0;
    const inline = match[2]?.trim() ?? "";
    if (inline && inline !== "|" && inline !== ">-") {
      commands.push({ command: inline, line: index + 1 });
      continue;
    }
    for (let bodyIndex = index + 1; bodyIndex < lines.length; bodyIndex++) {
      const bodyLine = lines[bodyIndex] ?? "";
      if (bodyLine.trim() && bodyLine.search(/\S/) <= indent) break;
      const command = bodyLine.trim();
      if (command) commands.push({ command, line: bodyIndex + 1 });
    }
  }
  return commands;
}

export function findWorkflowVerificationViolations(
  workflow: string,
  rootDir: string,
  allowlist: readonly string[] = ACTIONS_ONLY_WORKFLOW_COMMAND_ALLOWLIST,
): readonly WorkflowCommandViolation[] {
  const aliases = manifestOwnedAliases(rootDir);
  const argvKeys = manifestArgvKeys();
  const violations: WorkflowCommandViolation[] = [];
  for (const candidate of runCommands(workflow)) {
    for (const segment of splitShellCommands(candidate.command)) {
      const normalized = normalizeInvocation(segment);
      if (!/^(pnpm|node|npx|docker)\b/.test(normalized)) continue;
      if (/^pnpm verify:(?:repo|spine|publish)\b.*(?:^|\s)--profile(?:\s|=)/.test(normalized)) {
        violations.push({
          ...candidate,
          command: segment,
          reason: "verification profile aliases cannot override --profile",
        });
        continue;
      }
      if (allowlist.some((allowed) => matchesArgvPrefix(normalized, allowed))) continue;
      const direct = argvKeys.find((key) => matchesArgvPrefix(normalized, key));
      if (direct) {
        violations.push({
          ...candidate,
          command: segment,
          reason: `direct manifest command: ${direct}`,
        });
        continue;
      }
      const alias = normalized.match(/^pnpm\s+([^\s;]+)/)?.[1];
      if (alias && aliases.has(alias)) {
        violations.push({
          ...candidate,
          command: segment,
          reason: `manifest-owned root alias: ${alias}`,
        });
        continue;
      }
      violations.push({
        ...candidate,
        command: segment,
        reason: "command is not in the Actions-only allowlist",
      });
    }
  }
  return violations;
}

export function findPackageScriptVerificationDuplications(
  scripts: RootScripts,
): readonly WorkflowCommandViolation[] {
  const fingerprints = manifestArgvKeys();
  return Object.entries(scripts)
    .filter(([, command]) => fingerprints.some((fingerprint) => command.includes(fingerprint)))
    .map(([alias, command], index) => ({
      command,
      line: index + 1,
      reason: `root alias ${alias} duplicates a manifest executable array`,
    }));
}

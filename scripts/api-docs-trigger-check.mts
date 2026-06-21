#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

type Mode = "check" | "write";

type Options = {
  readonly mode: Mode;
  readonly rootDir: string;
  readonly workflowPath: string;
};

type ApiSourceFilter = {
  readonly globs: readonly string[];
  readonly lineEndExclusive: number;
  readonly lineStart: number;
  readonly nameIndent: string;
};

type Drift = {
  readonly missing: readonly string[];
  readonly unexpected: readonly string[];
};

const apiDocsDir = join("packages", "docs", "src", "content", "docs", "api");
const ciWorkflowPath = join(".github", "workflows", "ci.yml");
const apiSourceFilterName = "api-source";
const docsConfigGlobs = [
  "packages/docs/astro.config.mjs",
  "packages/docs/tsconfig.typedoc.json",
] as const;
const scriptRootDir = dirname(dirname(fileURLToPath(import.meta.url)));

export function expectedApiSourceGlobs(rootDir: string): readonly string[] {
  const docsRoot = join(rootDir, apiDocsDir);
  if (!existsSync(docsRoot)) {
    throw new Error(`${apiDocsDir} is missing`);
  }

  const packageNames = readdirSync(docsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const sourceGlobs = packageNames.map((packageName) => {
    const packageDir = join(rootDir, "packages", packageName);
    const packageJsonPath = join(packageDir, "package.json");
    const sourceDir = join(packageDir, "src");
    if (!existsSync(packageJsonPath)) {
      throw new Error(
        `${apiDocsDir}/${packageName} has no matching packages/${packageName}/package.json`,
      );
    }
    if (!existsSync(sourceDir)) {
      throw new Error(
        `${apiDocsDir}/${packageName} has no matching packages/${packageName}/src directory`,
      );
    }

    return `packages/${packageName}/src/**`;
  });

  return [...sourceGlobs, ...docsConfigGlobs];
}

export function readApiSourceFilter(workflow: string): ApiSourceFilter {
  const lines = workflow.split(/\r?\n/);
  const lineStart = lines.findIndex((line) => line.trim() === `${apiSourceFilterName}:`);
  if (lineStart === -1) {
    throw new Error(`${ciWorkflowPath} is missing the ${apiSourceFilterName} path filter`);
  }

  const nameIndent = lines[lineStart].match(/^\s*/)?.[0] ?? "";
  const globs: string[] = [];
  let lineEndExclusive = lines.length;

  for (let index = lineStart + 1; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      lineEndExclusive = index;
      break;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= nameIndent.length) {
      lineEndExclusive = index;
      break;
    }

    const item = trimmed.match(/^-\s+['"]?([^'"]+)['"]?$/);
    if (item) {
      globs.push(item[1]);
    }
  }

  return {
    globs,
    lineEndExclusive,
    lineStart,
    nameIndent,
  };
}

export function compareGlobs(actual: readonly string[], expected: readonly string[]): Drift {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);

  return {
    missing: expected.filter((glob) => !actualSet.has(glob)),
    unexpected: actual.filter((glob) => !expectedSet.has(glob)),
  };
}

export function hasDrift(
  drift: Drift,
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    drift.missing.length > 0 ||
    drift.unexpected.length > 0 ||
    actual.length !== expected.length ||
    actual.some((glob, index) => glob !== expected[index])
  );
}

export function writeApiSourceFilter(workflow: string, expected: readonly string[]): string {
  const newline = workflow.includes("\r\n") ? "\r\n" : "\n";
  const lines = workflow.split(/\r?\n/);
  const filter = readApiSourceFilter(workflow);
  const itemIndent = `${filter.nameIndent}  `;
  const replacement = [
    `${filter.nameIndent}${apiSourceFilterName}:`,
    ...expected.map((glob) => `${itemIndent}- '${glob}'`),
  ];

  lines.splice(filter.lineStart, filter.lineEndExclusive - filter.lineStart, ...replacement);
  return lines.join(newline);
}

function parseArgs(args: readonly string[]): Options {
  let mode: Mode = "check";
  let rootDir = scriptRootDir;
  let workflowPath = ciWorkflowPath;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--check") {
      mode = "check";
      continue;
    }

    if (arg === "--write") {
      mode = "write";
      continue;
    }

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--workflow") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--workflow requires a path");
      }
      workflowPath = value;
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    mode,
    rootDir,
    workflowPath: resolve(rootDir, workflowPath),
  };
}

function formatList(values: readonly string[]): string {
  return values.length === 0 ? "none" : values.join(", ");
}

function run(options: Options): readonly string[] {
  const expected = expectedApiSourceGlobs(options.rootDir);
  const workflow = readFileSync(options.workflowPath, "utf-8");
  const filter = readApiSourceFilter(workflow);
  const drift = compareGlobs(filter.globs, expected);
  const drifted = hasDrift(drift, filter.globs, expected);

  if (options.mode === "write") {
    const updated = writeApiSourceFilter(workflow, expected);
    if (updated !== workflow) {
      writeFileSync(options.workflowPath, updated);
    }
    return [];
  }

  if (!drifted) {
    return [];
  }

  const messages = [
    `${ciWorkflowPath} ${apiSourceFilterName} filter drift detected; run pnpm docs:api-triggers:write`,
  ];
  if (drift.missing.length > 0) {
    messages.push(`missing generated API docs source globs: ${formatList(drift.missing)}`);
  }
  if (drift.unexpected.length > 0) {
    messages.push(`unexpected API docs source globs: ${formatList(drift.unexpected)}`);
  }
  if (drift.missing.length === 0 && drift.unexpected.length === 0) {
    messages.push("API docs source globs are present but not in generated order");
  }

  return messages;
}

function main(): void {
  try {
    const violations = run(parseArgs(argv.slice(2)));
    if (violations.length > 0) {
      stdout.write("api-docs-trigger-check: CI API docs trigger drift detected.\n");
      for (const violation of violations) {
        stdout.write(`- ${violation}\n`);
      }
      exit(1);
    }

    stdout.write(
      "api-docs-trigger-check: CI API docs triggers match generated API docs surface.\n",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stdout.write(`api-docs-trigger-check: ${message}\n`);
    exit(1);
  }
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main();
}

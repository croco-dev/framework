#!/usr/bin/env node

/**
 * Enforce the circular-dependency allowlist by cycle identity, not by count.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { exit, stdout } from "node:process";

type Options = {
  readonly allowlistPath: string;
  readonly madgeJsonPath: string | null;
  readonly rootDir: string;
};

type Cycle = {
  readonly display: string;
  readonly key: string;
};

type AllowlistReadResult = {
  readonly cycles: readonly Cycle[];
  readonly errors: readonly string[];
};

function log(message: string): void {
  stdout.write(`${message}\n`);
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const allowlist = readAllowlist(options);
    const detectedCycles = readDetectedCycles(options);
    const violations = getViolations(allowlist.cycles, detectedCycles);

    if (
      allowlist.errors.length > 0 ||
      violations.newCycles.length > 0 ||
      violations.staleCycles.length > 0
    ) {
      log("circular-allowlist: detected cycles differ from .madge-circular-allowlist.txt.");

      if (allowlist.errors.length > 0) {
        log("");
        log("Invalid allowlist entries:");
        for (const error of allowlist.errors) {
          log(`- ${error}`);
        }
      }

      if (violations.newCycles.length > 0) {
        log("");
        log("New circular dependencies:");
        for (const cycle of violations.newCycles) {
          log(`- ${cycle.display}`);
        }
      }

      if (violations.staleCycles.length > 0) {
        log("");
        log("Stale allowlist entries:");
        for (const cycle of violations.staleCycles) {
          log(`- ${cycle.display}`);
        }
      }

      exit(1);
    }

    log(`circular-allowlist: passed (${detectedCycles.length} detected cycles match allowlist).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`circular-allowlist: ${message}`);
    exit(1);
  }
}

function parseArgs(args: readonly string[]): Options {
  let rootDir = process.cwd();
  let allowlistPath = ".madge-circular-allowlist.txt";
  let madgeJsonPath: string | null = null;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--root") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--root requires a path");
      }
      rootDir = resolve(value);
      index++;
      continue;
    }

    if (arg === "--allowlist") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--allowlist requires a path");
      }
      allowlistPath = value;
      index++;
      continue;
    }

    if (arg === "--madge-json") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--madge-json requires a path");
      }
      madgeJsonPath = value;
      index++;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    allowlistPath,
    madgeJsonPath,
    rootDir,
  };
}

function resolveFromRoot(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : join(rootDir, path);
}

function readAllowlist(options: Options): AllowlistReadResult {
  const path = resolveFromRoot(options.rootDir, options.allowlistPath);
  if (!existsSync(path)) {
    return {
      cycles: [],
      errors: [],
    };
  }

  const cycles: Cycle[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = readFileSync(path, "utf-8").replace(/\r\n/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const parsed = parseCycleLine(line);
    if (!parsed) {
      errors.push(
        `${options.allowlistPath}:${index + 1}: "${line}" must contain at least two paths separated by " > ".`,
      );
      continue;
    }

    if (seen.has(parsed.key)) {
      errors.push(
        `${options.allowlistPath}:${index + 1}: duplicate allowlist cycle "${parsed.display}".`,
      );
      continue;
    }

    seen.add(parsed.key);
    cycles.push(parsed);
  }

  return {
    cycles,
    errors,
  };
}

function readDetectedCycles(options: Options): Cycle[] {
  if (options.madgeJsonPath) {
    const path = resolveFromRoot(options.rootDir, options.madgeJsonPath);
    return parseMadgeCycles(readFileSync(path, "utf-8"), options.madgeJsonPath);
  }

  const result = spawnSync(
    "pnpm",
    ["exec", "madge", "--circular", "--extensions", "ts", "--json", "packages"],
    {
      cwd: options.rootDir,
      encoding: "utf-8",
    },
  );

  const cycles = parseMadgeCycles(result.stdout, "madge JSON output");

  if (result.status !== 0 && cycles.length === 0) {
    throw new Error(result.stderr.trim() || "madge failed without reporting circular dependencies");
  }

  return cycles;
}

function parseMadgeCycles(content: string, source: string): Cycle[] {
  const parsed: unknown = JSON.parse(content.trim() || "[]");
  if (!Array.isArray(parsed)) {
    throw new Error(`${source} must be a JSON array`);
  }

  const cycles: Cycle[] = [];
  const seen = new Set<string>();

  for (const value of parsed) {
    if (!Array.isArray(value) || value.some((part) => typeof part !== "string")) {
      throw new Error(`${source} must contain arrays of path strings`);
    }

    const cycle = normalizeCycle(value);
    if (!cycle) {
      throw new Error(`${source} contains a cycle with fewer than two paths`);
    }

    if (!seen.has(cycle.key)) {
      seen.add(cycle.key);
      cycles.push(cycle);
    }
  }

  return cycles;
}

function parseCycleLine(line: string): Cycle | null {
  return normalizeCycle(line.split(">").map((part) => part.trim()));
}

function normalizeCycle(rawParts: readonly string[]): Cycle | null {
  const parts = rawParts.map((part) => normalizePathPart(part)).filter((part) => part.length > 0);

  if (parts.length > 1 && parts[0] === parts[parts.length - 1]) {
    parts.pop();
  }

  if (parts.length < 2) {
    return null;
  }

  const canonicalParts = rotateToSmallest(parts);

  return {
    display: canonicalParts.join(" > "),
    key: canonicalParts.join("\u0000"),
  };
}

function normalizePathPart(part: string): string {
  return part.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/").trim();
}

function rotateToSmallest(parts: readonly string[]): string[] {
  let smallestIndex = 0;

  for (let index = 1; index < parts.length; index++) {
    if (compareRotation(parts, index, smallestIndex) < 0) {
      smallestIndex = index;
    }
  }

  return [...parts.slice(smallestIndex), ...parts.slice(0, smallestIndex)];
}

function compareRotation(parts: readonly string[], leftStart: number, rightStart: number): number {
  for (let offset = 0; offset < parts.length; offset++) {
    const left = parts[(leftStart + offset) % parts.length];
    const right = parts[(rightStart + offset) % parts.length];
    const comparison = left < right ? -1 : left > right ? 1 : 0;

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

function getViolations(allowlistCycles: readonly Cycle[], detectedCycles: readonly Cycle[]) {
  const allowlistByKey = new Map(allowlistCycles.map((cycle) => [cycle.key, cycle]));
  const detectedByKey = new Map(detectedCycles.map((cycle) => [cycle.key, cycle]));

  return {
    newCycles: detectedCycles.filter((cycle) => !allowlistByKey.has(cycle.key)),
    staleCycles: allowlistCycles.filter((cycle) => !detectedByKey.has(cycle.key)),
  };
}

main();

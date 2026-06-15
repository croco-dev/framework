#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { argv, exit, stdout } from "node:process";

type ChangesetsConfig = {
  readonly fixed?: unknown;
  readonly linked?: unknown;
};

type VersioningMode = "independent" | "fixed" | "linked" | "fixed-and-linked";

function log(message: string): void {
  stdout.write(`${message}\n`);
}

function parseRoot(args: readonly string[]): string {
  let rootDir = process.cwd();

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

    throw new Error(`Unknown option: ${arg}`);
  }

  return rootDir;
}

function readJson(path: string): ChangesetsConfig {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readGroups(value: unknown, fieldName: "fixed" | "linked"): string[][] {
  if (!Array.isArray(value)) {
    throw new Error(`.changeset/config.json ${fieldName} must be an array`);
  }

  return value.map((group, groupIndex) => {
    if (!Array.isArray(group)) {
      throw new Error(`.changeset/config.json ${fieldName}[${groupIndex}] must be an array`);
    }

    return group.map((packageName, packageIndex) => {
      if (typeof packageName !== "string" || packageName.length === 0) {
        throw new Error(
          `.changeset/config.json ${fieldName}[${groupIndex}][${packageIndex}] must be a package name`,
        );
      }

      return packageName;
    });
  });
}

function getVersioningMode(
  fixedGroups: readonly string[][],
  linkedGroups: readonly string[][],
): VersioningMode {
  if (fixedGroups.length > 0 && linkedGroups.length > 0) {
    return "fixed-and-linked";
  }

  if (fixedGroups.length > 0) {
    return "fixed";
  }

  if (linkedGroups.length > 0) {
    return "linked";
  }

  return "independent";
}

function groupPackages(groups: readonly string[][]): string[] {
  return groups.flatMap((group) => group);
}

function collectErrors(
  docs: string,
  mode: VersioningMode,
  fixedGroups: readonly string[][],
  linkedGroups: readonly string[][],
): string[] {
  const errors: string[] = [];

  if (!docs.includes("`.changeset/config.json`")) {
    errors.push("RELEASING.md must identify .changeset/config.json as the source of truth.");
  }

  if (!docs.includes("fixed") || !docs.includes("linked")) {
    errors.push("RELEASING.md must describe fixed/linked group behavior.");
  }

  if (mode === "independent") {
    if (!docs.includes("**Mode**: Independent")) {
      errors.push(
        "RELEASING.md must state `**Mode**: Independent` when fixed and linked groups are empty.",
      );
    }

    if (/Fixed Mode|모든\s+`?@croco\/\*`?\s+패키지가\s+동일\s+버전/.test(docs)) {
      errors.push(
        "RELEASING.md still describes fixed-mode versioning, but config has no fixed groups.",
      );
    }

    if (!docs.includes("publishable package를 각각")) {
      errors.push(
        "RELEASING.md must tell contributors to select each changed publishable package.",
      );
    }

    return errors;
  }

  if (fixedGroups.length > 0 && !docs.includes("**Mode**: Fixed")) {
    errors.push("RELEASING.md must state `**Mode**: Fixed` when fixed groups are configured.");
  }

  if (linkedGroups.length > 0 && !docs.includes("linked group")) {
    errors.push(
      "RELEASING.md must describe linked group behavior when linked groups are configured.",
    );
  }

  for (const packageName of groupPackages(fixedGroups)) {
    if (!docs.includes(packageName)) {
      errors.push(`RELEASING.md must mention fixed-group package ${packageName}.`);
    }
  }

  for (const packageName of groupPackages(linkedGroups)) {
    if (!docs.includes(packageName)) {
      errors.push(`RELEASING.md must mention linked-group package ${packageName}.`);
    }
  }

  return errors;
}

function main(): void {
  try {
    const rootDir = parseRoot(argv.slice(2));
    const config = readJson(join(rootDir, ".changeset/config.json"));
    const docs = readFileSync(join(rootDir, "RELEASING.md"), "utf-8");
    const fixedGroups = readGroups(config.fixed ?? [], "fixed");
    const linkedGroups = readGroups(config.linked ?? [], "linked");
    const mode = getVersioningMode(fixedGroups, linkedGroups);
    const errors = collectErrors(docs, mode, fixedGroups, linkedGroups);

    if (errors.length === 0) {
      log(`release-docs: Changesets config and release guide agree on ${mode} versioning.`);
      exit(0);
    }

    log("release-docs: Changesets config and release guide disagree.");
    for (const error of errors) {
      log(`- ${error}`);
    }
    exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`release-docs: failed: ${message}`);
    exit(1);
  }
}

main();

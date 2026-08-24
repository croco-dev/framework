#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { argv, exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

type Command = {
  readonly args: readonly string[];
  readonly executable: string;
  readonly label: string;
};

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const writeCommands: readonly Command[] = [
  {
    executable: pnpmExecutable,
    args: ["exec", "changeset", "version"],
    label: "apply Changesets versions",
  },
  {
    executable: pnpmExecutable,
    args: ["package-manifests:write"],
    label: "normalize package manifests",
  },
  {
    executable: pnpmExecutable,
    args: ["release-version-sync:write"],
    label: "synchronize version-derived release metadata",
  },
  {
    executable: pnpmExecutable,
    args: ["docs:catalog:write"],
    label: "regenerate package documentation",
  },
];

const dryRunCommands: readonly Command[] = [
  {
    executable: pnpmExecutable,
    args: ["exec", "changeset", "status"],
    label: "preview pending Changesets versions",
  },
  {
    executable: pnpmExecutable,
    args: ["package-manifests:check"],
    label: "verify package manifests",
  },
  {
    executable: pnpmExecutable,
    args: ["release-version-sync:check"],
    label: "verify version-derived release metadata",
  },
  {
    executable: pnpmExecutable,
    args: ["docs:catalog:check"],
    label: "verify package documentation",
  },
];

function parseMode(args: readonly string[]): "dry-run" | "write" {
  if (args.length === 0) {
    return "write";
  }

  if (args.length === 1 && args[0] === "--dry-run") {
    return "dry-run";
  }

  const renderedArgs = args.length === 0 ? "<none>" : args.join(" ");
  throw new Error(`unsupported arguments: ${renderedArgs}; expected only --dry-run`);
}

function runCommands(commands: readonly Command[]): void {
  for (const command of commands) {
    stdout.write(`version-packages: ${command.label}.\n`);
    const result = spawnSync(command.executable, [...command.args], {
      cwd: rootDir,
      stdio: "inherit",
    });

    if (result.error) {
      stdout.write(`version-packages: ${command.label} could not start: ${result.error.message}\n`);
      exit(1);
    }

    if (result.status !== 0) {
      stdout.write(
        `version-packages: ${command.label} failed with status ${String(result.status)}.\n`,
      );
      exit(result.status ?? 1);
    }
  }
}

let mode: "dry-run" | "write";

try {
  mode = parseMode(argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  stdout.write(`version-packages: ${message}.\n`);
  exit(1);
}

if (mode === "dry-run") {
  stdout.write("version-packages: dry-run; no release files will be modified.\n");
  runCommands(dryRunCommands);
  stdout.write("version-packages: dry-run verification completed without modifying files.\n");
  exit(0);
}

runCommands(writeCommands);

stdout.write("version-packages: release PR metadata is synchronized.\n");

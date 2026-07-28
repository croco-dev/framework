#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { exit, stdout } from "node:process";
import { fileURLToPath } from "node:url";

type Command = {
  readonly args: readonly string[];
  readonly executable: string;
  readonly label: string;
};

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const pnpmExecutable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const commands: readonly Command[] = [
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

stdout.write("version-packages: release PR metadata is synchronized.\n");

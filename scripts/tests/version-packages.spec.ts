import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../version-packages.mts");
const tempDirectories: string[] = [];

describe("version-packages.mts", () => {
  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("runs only read-only preview and verification commands in dry-run mode", () => {
    const harness = createCommandHarness();
    const result = runScript(harness, "--dry-run");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dry-run; no release files will be modified");
    expect(readCommands(harness.logPath)).toEqual([
      ["exec", "changeset", "status"],
      ["package-manifests:check"],
      ["release-version-sync:check"],
      ["docs:catalog:check"],
    ]);
    expect(result.stdout).toContain("dry-run verification completed without modifying files");
  });

  it("preserves the ordered mutating release synchronization when no option is provided", () => {
    const harness = createCommandHarness();
    const result = runScript(harness);

    expect(result.status).toBe(0);
    expect(readCommands(harness.logPath)).toEqual([
      ["exec", "changeset", "version"],
      ["package-manifests:write"],
      ["release-version-sync:write"],
      ["docs:catalog:write"],
    ]);
    expect(result.stdout).toContain("release PR metadata is synchronized");
  });

  it("rejects unsupported arguments before starting any command", () => {
    const harness = createCommandHarness();
    const result = runScript(harness, "--dry-run", "--unknown");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "unsupported arguments: --dry-run --unknown; expected only --dry-run",
    );
    expect(readCommands(harness.logPath)).toEqual([]);
  });
});

type CommandHarness = {
  readonly binDirectory: string;
  readonly logPath: string;
};

function createCommandHarness(): CommandHarness {
  const directory = mkdtempSync(join(tmpdir(), "croco-version-packages-"));
  tempDirectories.push(directory);
  const executableName = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const executablePath = join(directory, executableName);
  const logPath = join(directory, "commands.log");

  writeFileSync(
    executablePath,
    [
      "#!/usr/bin/env node",
      'const { appendFileSync } = require("node:fs");',
      "appendFileSync(process.env.VERSION_PACKAGES_COMMAND_LOG, `${JSON.stringify(process.argv.slice(2))}\\n`);",
      "",
    ].join("\n"),
    "utf-8",
  );
  chmodSync(executablePath, 0o755);

  return { binDirectory: directory, logPath };
}

function runScript(harness: CommandHarness, ...args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", scriptPath, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${harness.binDirectory}${delimiter}${process.env.PATH ?? ""}`,
      VERSION_PACKAGES_COMMAND_LOG: harness.logPath,
    },
  });
}

function readCommands(logPath: string): readonly (readonly string[])[] {
  if (!existsSync(logPath)) {
    return [];
  }

  return readFileSync(logPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as readonly string[]);
}

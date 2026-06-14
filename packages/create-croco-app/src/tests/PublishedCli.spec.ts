import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;

describe("published create-croco-app CLI", () => {
  it(
    "prints the package manifest version from the built binary",
    () => {
      ensureBuilt();

      const packageVersion = readPackageVersion();
      const version = run("node", [join(packageDir, "dist", "index.js"), "--version"], rootDir);

      expect(version.stdout.trim()).toBe(packageVersion);
    },
    spawnTimeoutMs,
  );
});

function ensureBuilt(): void {
  if (existsSync(join(packageDir, "dist", "index.js"))) {
    return;
  }

  run("pnpm", ["--filter", "create-croco-app...", "build"], rootDir);
}

function readPackageVersion(): string {
  const manifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as {
    version?: unknown;
  };

  if (typeof manifest.version !== "string") {
    throw new Error("Missing package version in package.json");
  }

  return manifest.version;
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
): { stdout: string; stderr: string } {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: spawnTimeoutMs,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.error ? `${result.error.name}: ${result.error.message}` : undefined,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

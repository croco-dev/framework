import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
    "prints the package manifest version from the installed package",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-create-app-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-create-app-consumer-"));

      try {
        ensureBuilt();
        run(
          "pnpm",
          ["--filter", "@croco/problems-core", "pack", "--pack-destination", packRoot],
          rootDir,
        );
        run(
          "pnpm",
          ["--filter", "@croco/diagnostics-core", "pack", "--pack-destination", packRoot],
          rootDir,
        );
        run(
          "pnpm",
          ["--filter", "@croco/telemetry-sdk-node", "pack", "--pack-destination", packRoot],
          rootDir,
        );
        run(
          "pnpm",
          ["--filter", "create-croco-app", "pack", "--pack-destination", packRoot],
          rootDir,
        );

        const problemsCoreTarball = findTarball(packRoot, "croco-problems-core-");
        const diagnosticsCoreTarball = findTarball(packRoot, "croco-diagnostics-core-");
        const telemetrySdkNodeTarball = findTarball(packRoot, "croco-telemetry-sdk-node-");
        const createCrocoAppTarball = findTarball(packRoot, "create-croco-app-");

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify(
            {
              name: "create-croco-app-consumer",
              private: true,
              pnpm: {
                overrides: {
                  "@croco/problems-core": `file:${problemsCoreTarball}`,
                  "@croco/diagnostics-core": `file:${diagnosticsCoreTarball}`,
                  "@croco/telemetry-sdk-node": `file:${telemetrySdkNodeTarball}`,
                },
              },
              type: "module",
            },
            null,
            2,
          )}\n`,
        );

        run("pnpm", ["add", "--prod", createCrocoAppTarball, "--ignore-scripts"], consumerRoot);

        const packageVersion = readPackageVersion();
        const version = run("pnpm", ["exec", "create-croco-app", "--version"], consumerRoot);

        expect(version.stdout.trim()).toBe(packageVersion);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    spawnTimeoutMs,
  );
});

function ensureBuilt(): void {
  if (
    existsSync(join(rootDir, "packages", "problems-core", "dist", "index.js")) &&
    existsSync(join(rootDir, "packages", "diagnostics-core", "dist", "index.js")) &&
    existsSync(join(rootDir, "packages", "telemetry-sdk-node", "dist", "index.js")) &&
    existsSync(join(packageDir, "dist", "index.js"))
  ) {
    return;
  }

  run("pnpm", ["--filter", "create-croco-app...", "build"], rootDir);
}

function findTarball(directory: string, prefix: string): string {
  const filename = readdirSync(directory).find(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"),
  );

  if (!filename) {
    throw new Error(`Missing packed tarball with prefix ${prefix}`);
  }

  return join(directory, filename);
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

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;

describe("published migrate CLI", () => {
  it(
    "installs the Postgres driver needed by the published binary",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-migration-runner-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-migration-runner-consumer-"));

      try {
        ensureBuilt();
        run(
          "pnpm",
          ["--filter", "@croco/problems-core", "pack", "--pack-destination", packRoot],
          rootDir,
        );
        run(
          "pnpm",
          ["--filter", "@croco/migration-runner", "pack", "--pack-destination", packRoot],
          rootDir,
        );

        const problemsCoreTarball = findTarball(packRoot, "croco-problems-core-");
        const migrationRunnerTarball = findTarball(packRoot, "croco-migration-runner-");
        const packedManifest = JSON.parse(
          run("tar", ["-xOf", migrationRunnerTarball, "package/package.json"], rootDir).stdout,
        ) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        expect(packedManifest.dependencies?.pg).toBe("^8.11.0");
        expect(packedManifest.devDependencies?.pg).toBeUndefined();

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify(
            {
              name: "croco-migration-runner-consumer",
              private: true,
              type: "commonjs",
            },
            null,
            2,
          )}\n`,
        );
        writePnpmWorkspaceOverrides(consumerRoot, {
          "@croco/problems-core": `file:${problemsCoreTarball}`,
        });

        run("pnpm", ["add", "--prod", migrationRunnerTarball, "--ignore-scripts"], consumerRoot);

        const help = run("pnpm", ["exec", "migrate", "--help"], consumerRoot);
        expect(help.stdout).toContain("Drizzle migration runner");

        const packageVersion = readPackageVersion();
        const installedVersion = run("pnpm", ["exec", "migrate", "--version"], consumerRoot);
        expect(installedVersion.stdout.trim()).toBe(packageVersion);
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
    existsSync(join(packageDir, "dist", "cli.js"))
  ) {
    return;
  }

  run("pnpm", ["--filter", "@croco/problems-core", "build"], rootDir);
  run("pnpm", ["--filter", "@croco/migration-runner", "build"], rootDir);
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

function writePnpmWorkspaceOverrides(
  consumerRoot: string,
  overrides: Record<string, string>,
): void {
  const lines = [
    "packages:",
    "  - .",
    "overrides:",
    ...Object.entries(overrides).map(
      ([packageName, range]) => `  ${JSON.stringify(packageName)}: ${JSON.stringify(range)}`,
    ),
  ];

  writeFileSync(join(consumerRoot, "pnpm-workspace.yaml"), `${lines.join("\n")}\n`);
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

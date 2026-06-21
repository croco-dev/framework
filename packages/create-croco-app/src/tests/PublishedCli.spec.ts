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
// These tarballs cover the packed CLI's local Croco runtime dependency graph, including transitive deps.
const packedRuntimeWorkspacePackages = ["problems-core", "diagnostics-core", "telemetry-sdk-node"];
const requiredPackageArtifacts = [
  ...packedRuntimeWorkspacePackages.flatMap((packageName) => requiredLibraryArtifacts(packageName)),
  join(packageDir, "dist", "index.js"),
  join(packageDir, "dist", "index.d.ts"),
];

describe("published create-croco-app CLI", () => {
  it(
    "prints the package manifest version from the installed package",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-create-app-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-create-app-consumer-"));

      try {
        ensureBuilt();
        packRuntimeWorkspacePackages(packRoot);
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

function packRuntimeWorkspacePackages(packRoot: string): void {
  for (const packageName of packedRuntimeWorkspacePackages) {
    run(
      "pnpm",
      ["--filter", `@croco/${packageName}`, "pack", "--pack-destination", packRoot],
      rootDir,
    );
  }
}

function ensureBuilt(): void {
  if (requiredPackageArtifacts.every((artifact) => existsSync(artifact))) {
    return;
  }

  run("pnpm", ["--filter", "create-croco-app...", "build"], rootDir);

  const missingArtifacts = requiredPackageArtifacts.filter((artifact) => !existsSync(artifact));
  if (missingArtifacts.length > 0) {
    throw new Error(
      `Missing build artifacts after build:\n${missingArtifacts.map((artifact) => `- ${artifact}`).join("\n")}`,
    );
  }
}

function requiredLibraryArtifacts(packageName: string): string[] {
  const distDir = join(rootDir, "packages", packageName, "dist");

  return ["index.js", "index.mjs", "index.d.ts", "index.d.mts"].map((filename) =>
    join(distDir, filename),
  );
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

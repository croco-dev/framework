import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;

describe("published RPC codegen CLI", () => {
  it(
    "installs an executable binary that starts through the published package contract",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-rpc-codegen-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-rpc-codegen-consumer-"));

      try {
        ensureBuilt();
        run(
          "pnpm",
          ["--filter", "@croco/problems-core", "pack", "--pack-destination", packRoot],
          rootDir,
        );
        run(
          "pnpm",
          ["--filter", "@croco/protocols-core", "pack", "--pack-destination", packRoot],
          rootDir,
        );
        run(
          "pnpm",
          ["--filter", "@croco/rpc-codegen", "pack", "--pack-destination", packRoot],
          rootDir,
        );

        const problemsCoreTarball = findTarball(packRoot, "croco-problems-core-");
        const protocolsCoreTarball = findTarball(packRoot, "croco-protocols-core-");
        const rpcCodegenTarball = findTarball(packRoot, "croco-rpc-codegen-");
        const packedManifest = JSON.parse(
          run("tar", ["-xOf", rpcCodegenTarball, "package/package.json"], rootDir).stdout,
        ) as {
          bin?: Record<string, string>;
        };
        const packedCli = run(
          "tar",
          ["-xOf", rpcCodegenTarball, "package/dist/cli.js"],
          rootDir,
        ).stdout;

        expect(packedManifest.bin?.["croco-rpc-codegen"]).toBe("./dist/cli.js");
        expect(packedCli.split(/\r?\n/, 1)[0]).toBe("#!/usr/bin/env node");

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify(
            {
              name: "croco-rpc-codegen-consumer",
              private: true,
              pnpm: {
                overrides: {
                  "@croco/problems-core": `file:${problemsCoreTarball}`,
                  "@croco/protocols-core": `file:${protocolsCoreTarball}`,
                },
              },
              type: "module",
            },
            null,
            2,
          )}\n`,
        );

        run("pnpm", ["add", "--prod", rpcCodegenTarball, "--ignore-scripts"], consumerRoot);

        const help = run("pnpm", ["exec", "croco-rpc-codegen", "--help"], consumerRoot);
        expect(help.stdout).toContain("Usage: croco-rpc-codegen");
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
    existsSync(join(rootDir, "packages", "protocols-core", "dist", "index.js")) &&
    existsSync(join(packageDir, "dist", "cli.js"))
  ) {
    return;
  }

  run("pnpm", ["--filter", "@croco/problems-core", "build"], rootDir);
  run("pnpm", ["--filter", "@croco/protocols-core", "build"], rootDir);
  run("pnpm", ["--filter", "@croco/rpc-codegen", "build"], rootDir);
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

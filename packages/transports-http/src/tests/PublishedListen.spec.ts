import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 60_000;

describe("published HTTP listen contract", () => {
  it(
    "publishes fixed Hono ranges and the Node server adapter as runtime dependencies",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-transports-http-pack-"));

      try {
        const packages = [
          {
            name: "@croco/transports-http",
            tarballPrefix: "croco-transports-http-",
            usesNodeServer: true,
          },
          {
            name: "@croco/preset-node",
            tarballPrefix: "croco-preset-node-",
            usesNodeServer: true,
          },
          {
            name: "@croco/preset-lambda",
            tarballPrefix: "croco-preset-lambda-",
            usesNodeServer: false,
          },
        ] as const;

        for (const packageInfo of packages) {
          run(
            "pnpm",
            ["--filter", packageInfo.name, "pack", "--pack-destination", packRoot],
            rootDir,
          );

          const tarball = findTarball(packRoot, packageInfo.tarballPrefix);
          const packedManifest = JSON.parse(
            run("tar", ["-xOf", tarball, "package/package.json"], rootDir).stdout,
          ) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };

          expect(packedManifest.dependencies?.hono).toBe("^4.12.34");

          if (packageInfo.usesNodeServer) {
            expect(packedManifest.dependencies?.["@hono/node-server"]).toBe("^1.19.17");
            expect(packedManifest.devDependencies?.["@hono/node-server"]).toBeUndefined();
          }
        }
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
      }
    },
    spawnTimeoutMs,
  );
});

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

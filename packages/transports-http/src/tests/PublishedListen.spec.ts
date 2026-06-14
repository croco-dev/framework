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
    "publishes the Node server adapter as a runtime dependency",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-transports-http-pack-"));

      try {
        run(
          "pnpm",
          ["--filter", "@croco/transports-http", "pack", "--pack-destination", packRoot],
          rootDir,
        );

        const transportsHttpTarball = findTarball(packRoot, "croco-transports-http-");
        const packedManifest = JSON.parse(
          run("tar", ["-xOf", transportsHttpTarball, "package/package.json"], rootDir).stdout,
        ) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        expect(packedManifest.dependencies?.["@hono/node-server"]).toBe("^1.19.10");
        expect(packedManifest.devDependencies?.["@hono/node-server"]).toBeUndefined();
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

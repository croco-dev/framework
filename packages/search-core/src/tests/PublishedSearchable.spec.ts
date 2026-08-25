import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";

import type { SearchableIndexDeclaration } from "../libs/decorators/Searchable";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootDir = resolve(packageDir, "../..");
const timeoutMs = 300_000;

describe("published @Searchable decorator", () => {
  beforeEach(() => {
    Container.reset();
  });

  it(
    "reports consumer declaration locations independently of registration order",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-searchable-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-searchable-consumer-"));

      try {
        ensureBuilt();
        const tarballs = {
          problemsCore: pack("@croco/problems-core", "croco-problems-core-", packRoot),
          diagnosticsCore: pack("@croco/diagnostics-core", "croco-diagnostics-core-", packRoot),
          frameworkContext: pack("@croco/framework-context", "croco-framework-context-", packRoot),
          eventsCore: pack("@croco/events-core", "croco-events-core-", packRoot),
          searchCore: pack("@croco/search-core", "croco-search-core-", packRoot),
        };
        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify({ name: "searchable-consumer", private: true, type: "module" }, null, 2)}\n`,
        );
        writeFileSync(
          join(consumerRoot, "pnpm-workspace.yaml"),
          [
            "packages:",
            "  - .",
            "overrides:",
            `  '@croco/problems-core': 'file:${tarballs.problemsCore}'`,
            `  '@croco/diagnostics-core': 'file:${tarballs.diagnosticsCore}'`,
            `  '@croco/framework-context': 'file:${tarballs.frameworkContext}'`,
            `  '@croco/events-core': 'file:${tarballs.eventsCore}'`,
            "",
          ].join("\n"),
        );
        run(
          "pnpm",
          ["add", "--prod", ...Object.values(tarballs), "--ignore-scripts"],
          consumerRoot,
        );
        const consumerPath = join(consumerRoot, "consumer.mjs");
        writeConsumer(consumerPath);

        const alphaFirst = runConsumer(consumerPath, "alpha,zeta");
        const zetaFirst = runConsumer(consumerPath, "zeta,alpha");

        expect(zetaFirst).toEqual(alphaFirst);
        expect(alphaFirst).toHaveLength(2);
        expect(alphaFirst.map((declaration) => declaration.targetName)).toEqual([
          "AlphaEntity",
          "ZetaEntity",
        ]);
        expect(alphaFirst.map((declaration) => declaration.sourceLocation?.path)).toEqual([
          realpathSync(consumerPath),
          realpathSync(consumerPath),
        ]);
        expect(
          new Set(alphaFirst.map((declaration) => declaration.sourceLocation?.line)).size,
        ).toBe(2);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    timeoutMs,
  );
});

function ensureBuilt(): void {
  if (existsBuiltPackage()) return;
  run("pnpm", ["--filter", "@croco/search-core...", "build"], rootDir);
}

function existsBuiltPackage(): boolean {
  const declaration = join(packageDir, "dist", "index.d.ts");
  return (
    existsSync(declaration) &&
    statSync(declaration).mtimeMs >= latestTypeScriptModifiedAt(join(packageDir, "src"))
  );
}

function latestTypeScriptModifiedAt(directory: string): number {
  return readdirSync(directory, { withFileTypes: true }).reduce((latest, entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "tests") return latest;
      return Math.max(latest, latestTypeScriptModifiedAt(entryPath));
    }
    return entry.isFile() && entry.name.endsWith(".ts")
      ? Math.max(latest, statSync(entryPath).mtimeMs)
      : latest;
  }, 0);
}

function pack(packageName: string, prefix: string, destination: string): string {
  run("pnpm", ["--filter", packageName, "pack", "--pack-destination", destination], rootDir);
  const filename = readdirSync(destination).find(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"),
  );
  if (!filename) expect.fail(`Missing packed tarball with prefix ${prefix}`);
  return join(destination, filename);
}

function writeConsumer(consumerPath: string): void {
  writeFileSync(
    consumerPath,
    [
      'import { Searchable, SearchableIndexConflictProblem } from "@croco/search-core";',
      "class AlphaEntity {}",
      "class ZetaEntity {}",
      'const registerAlpha = () => Searchable({ index: "shared", autoSync: true })(AlphaEntity);',
      'const registerZeta = () => Searchable({ index: "shared", autoSync: true })(ZetaEntity);',
      "const registrations = { alpha: registerAlpha, zeta: registerZeta };",
      "let declarations;",
      "try {",
      '  for (const name of process.argv[2].split(",")) registrations[name]();',
      "} catch (error) {",
      "  if (!(error instanceof SearchableIndexConflictProblem)) throw error;",
      "  declarations = error.extensions.declarations;",
      "}",
      'if (!declarations) { process.stderr.write("Expected a searchable index conflict\\n"); process.exit(1); }',
      "process.stdout.write(JSON.stringify(declarations));",
      "",
    ].join("\n"),
  );
}

function runConsumer(consumerPath: string, order: string): readonly SearchableIndexDeclaration[] {
  return JSON.parse(run("node", [consumerPath, order], rootDir)) as SearchableIndexDeclaration[];
}

function run(command: string, arguments_: readonly string[], cwd: string): string {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    killSignal: "SIGKILL",
    maxBuffer: 16 * 1024 * 1024,
    timeout: timeoutMs,
  });
  expect(result.error, result.error?.message).toBeUndefined();
  expect(
    result.status,
    `${command} ${arguments_.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
  ).toBe(0);
  return result.stdout;
}

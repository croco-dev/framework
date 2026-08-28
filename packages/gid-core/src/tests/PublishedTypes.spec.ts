import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const filename = fileURLToPath(import.meta.url);
const testsDir = dirname(filename);
const packageDir = resolve(testsDir, "../..");
const rootDir = resolve(packageDir, "../..");
const fixtureDir = join(testsDir, "fixtures");
const timeoutMs = 180_000;

describe("published GID types", () => {
  it(
    "preserves IdOf and omits the runtime Id marker in a clean packed consumer",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-gid-core-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-gid-core-consumer-"));

      try {
        ensureBuilt();
        pack("@croco/problems-core", packRoot);
        pack("@croco/gid-core", packRoot);

        const problemsCore = findTarball(packRoot, "croco-problems-core-");
        const gidCore = findTarball(packRoot, "croco-gid-core-");
        const declarations = run(
          "tar",
          ["-xOf", gidCore, "package/dist/index.d.ts"],
          rootDir,
        ).stdout;

        expect(declarations).toContain("type IdOf<");
        expect(declarations).not.toContain("readonly Id:");
        writeConsumer(consumerRoot, problemsCore);
        run("pnpm", ["add", "--prod", gidCore, "--ignore-scripts"], consumerRoot);
        run("node", [typescriptPath(), "-p", "tsconfig.json"], consumerRoot);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    timeoutMs,
  );
});

function ensureBuilt(): void {
  const problemsCoreDir = resolve(rootDir, "packages/problems-core");
  if (!shouldBuild(problemsCoreDir) && !shouldBuild(packageDir)) {
    return;
  }

  run("pnpm", ["--filter", "@croco/gid-core...", "build"], rootDir);
}

function shouldBuild(directory: string): boolean {
  const declarationPath = join(directory, "dist/index.d.ts");
  if (!existsSync(declarationPath)) {
    return true;
  }

  return latestInputModifiedAt(directory) > statSync(declarationPath).mtimeMs;
}

function latestInputModifiedAt(directory: string): number {
  return Math.max(
    statSync(join(directory, "package.json")).mtimeMs,
    latestTypeScriptModifiedAt(join(directory, "src")),
  );
}

function latestTypeScriptModifiedAt(directory: string): number {
  return readdirSync(directory, { withFileTypes: true }).reduce((latest, entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return Math.max(latest, latestTypeScriptModifiedAt(entryPath));
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      return latest;
    }
    return Math.max(latest, statSync(entryPath).mtimeMs);
  }, 0);
}

function pack(packageName: string, destination: string): void {
  run("pnpm", ["--filter", packageName, "pack", "--pack-destination", destination], rootDir);
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

function writeConsumer(consumerRoot: string, problemsCore: string): void {
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "gid-core-consumer", private: true, type: "module" }, null, 2)}\n`,
  );
  writeFileSync(
    join(consumerRoot, "pnpm-workspace.yaml"),
    [
      "packages:",
      "  - .",
      "overrides:",
      `  '@croco/problems-core': 'file:${problemsCore}'`,
      "",
    ].join("\n"),
  );
  copyFileSync(join(fixtureDir, "published-types-positive.ts"), join(consumerRoot, "positive.ts"));
  copyFileSync(join(fixtureDir, "published-types-negative.ts"), join(consumerRoot, "negative.ts"));
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: "ES2022",
        },
        include: ["positive.ts", "negative.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function typescriptPath(): string {
  return join(rootDir, "node_modules/typescript/lib/tsc.js");
}

function run(
  command: string,
  args: readonly string[],
  cwd: string,
): { readonly stderr: string; readonly stdout: string } {
  const result = spawnSync(command, [...args], {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    timeout: timeoutMs,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed`,
        result.error?.message,
        result.stdout.trim(),
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { stderr: result.stderr, stdout: result.stdout };
}

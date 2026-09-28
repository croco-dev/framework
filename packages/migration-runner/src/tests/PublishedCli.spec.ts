import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
    "installs the Postgres driver and validates TypeScript migrations with the published binary",
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
        assertTarballEntry(problemsCoreTarball, "package/dist/index.js");
        assertTarballEntry(migrationRunnerTarball, "package/dist/cli.js");
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

        writePackedCliMigrationSmoke(consumerRoot);
        const migrationSmoke = run("node", ["packed-cli-migration-smoke.cjs"], consumerRoot);
        expect(migrationSmoke.stdout).toContain("migration body executed");

        const typescriptMigrationsDir = join(consumerRoot, "typescript-migrations");
        mkdirSync(typescriptMigrationsDir);
        writeFileSync(join(typescriptMigrationsDir, "package.json"), '{"type":"module"}\n');
        writeFileSync(
          join(typescriptMigrationsDir, "20260728000001_initialize.ts"),
          [
            "import type { DatabaseClient } from '@croco/migration-runner';",
            "export async function up(db: DatabaseClient): Promise<void> {",
            "  await db.execute({ kind: 'migration-body' });",
            "}",
            "export async function down(): Promise<void> {}",
            "",
          ].join("\n"),
        );
        const validation = run(
          "pnpm",
          ["exec", "migrate", "validate", "--dir", typescriptMigrationsDir],
          consumerRoot,
        );
        expect(validation.stdout).toContain("Validated 1 migration(s)");
        expect(validation.stdout).toContain("20260728000001_initialize");
        const typescriptSmoke = run(
          "node",
          ["packed-cli-migration-smoke.cjs", typescriptMigrationsDir, "20260728000001"],
          consumerRoot,
        );
        expect(typescriptSmoke.stdout).toContain("migration body executed");

        writeFileSync(
          join(typescriptMigrationsDir, "20260728000002_nonerasable.ts"),
          [
            "enum MigrationState { Pending, Complete }",
            "export async function up(): Promise<void> {",
            "  console.log(MigrationState.Complete);",
            "}",
            "export async function down(): Promise<void> {}",
            "",
          ].join("\n"),
        );
        const unsupportedValidation = spawnSync(
          "pnpm",
          ["exec", "migrate", "validate", "--dir", typescriptMigrationsDir],
          {
            cwd: consumerRoot,
            encoding: "utf-8",
            stdio: "pipe",
            timeout: spawnTimeoutMs,
            env: { ...process.env, DATABASE_URL: "" },
          },
        );
        expect(unsupportedValidation.error).toBeUndefined();
        expect(unsupportedValidation.status).toBe(1);
        expect(unsupportedValidation.stderr).toContain("20260728000002_nonerasable.ts");
        expect(unsupportedValidation.stderr).toMatch(/erasable TypeScript/i);
        expect(unsupportedValidation.stderr).toMatch(/compile.*\.js/i);
        expect(unsupportedValidation.stderr).not.toContain("DATABASE_URL_REQUIRED");

        writeFileSync(
          join(typescriptMigrationsDir, "20260728000002_nonerasable.ts"),
          [
            "function sealed(_target: Function): void {}",
            "@sealed",
            "class DecoratedMigration {}",
            "export async function up(): Promise<void> {}",
            "export async function down(): Promise<void> {}",
            "",
          ].join("\n"),
        );
        const unsupportedDecorator = spawnSync(
          "pnpm",
          ["exec", "migrate", "validate", "--dir", typescriptMigrationsDir],
          {
            cwd: consumerRoot,
            encoding: "utf-8",
            stdio: "pipe",
            timeout: spawnTimeoutMs,
            env: { ...process.env, DATABASE_URL: "" },
          },
        );
        expect(unsupportedDecorator.error).toBeUndefined();
        expect(unsupportedDecorator.status).toBe(1);
        expect(unsupportedDecorator.stderr).toContain("20260728000002_nonerasable.ts");
        expect(unsupportedDecorator.stderr).toMatch(/decorator/i);
        expect(unsupportedDecorator.stderr).toMatch(/erasable TypeScript/i);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    spawnTimeoutMs,
  );
});

function ensureBuilt(): void {
  const problemsCoreDir = join(rootDir, "packages", "problems-core");

  if (!hasBuiltFiles(problemsCoreDir, ["index.js", "index.d.ts"])) {
    run("pnpm", ["--filter", "@croco/problems-core", "build"], rootDir);
  }

  if (!hasBuiltFiles(packageDir, ["cli.js", "cli.d.ts", "index.js", "index.d.ts"])) {
    run("pnpm", ["--filter", "@croco/migration-runner", "build"], rootDir);
  }
}

function writePackedCliMigrationSmoke(consumerRoot: string): void {
  const migrationsDir = join(consumerRoot, "migrations");
  mkdirSync(migrationsDir);
  writeFileSync(
    join(migrationsDir, "20260728000000_initialize.js"),
    [
      "exports.up = async function up(db) {",
      "  await db.execute({ kind: 'migration-body' });",
      "};",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "packed-cli-migration-smoke.cjs"),
    [
      "const { createProgram } = require('@croco/migration-runner/cli');",
      "",
      "let executeCall = 0;",
      "let migrationBodyExecuted = false;",
      "const migrationId = process.argv[3] ?? '20260728000000';",
      "const db = {",
      "  async execute(query) {",
      "    executeCall += 1;",
      "    if (query?.kind === 'migration-body') {",
      "      migrationBodyExecuted = true;",
      "      return [];",
      "    }",
      "    if (executeCall === 3) return { rows: [{ id: migrationId }] };",
      "    return [];",
      "  },",
      "  async transaction(work) {",
      "    return work(db);",
      "  },",
      "};",
      "",
      "let exitCode;",
      "const runtime = {",
      "    async createDbClient() {",
      "      return { db, pool: { async end() {} } };",
      "    },",
      "    writeOutput() {},",
      "    writeError(message) { throw new Error(message); },",
      "    exit(code) { exitCode = code; },",
      "};",
      "const command = ['node', 'migrate', 'up'];",
      "if (process.argv[2]) command.push('--dir', process.argv[2]);",
      "createProgram(runtime).parseAsync(command).then(() => {",
      "  if (exitCode !== 0 || !migrationBodyExecuted) {",
      "    throw new Error(`packed migration smoke failed: exit=${exitCode}, executed=${migrationBodyExecuted}`);",
      "  }",
      "  console.log('migration body executed');",
      "});",
      "",
    ].join("\n"),
  );
}

function hasBuiltFiles(packageRoot: string, files: readonly string[]): boolean {
  return files.every((file) => existsSync(join(packageRoot, "dist", file)));
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

function assertTarballEntry(tarball: string, entry: string): void {
  const listing = run("tar", ["-tzf", tarball], rootDir).stdout;
  expect(listing.split("\n")).toContain(entry);
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
    env: { ...process.env, DATABASE_URL: "" },
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

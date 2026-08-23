import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { MigrationScanner } from "../libs/MigrationScanner";
import type { MigrationFileLoadProblem } from "../libs/problems/MigrationFileLoadProblem";

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    rmSync(tempRoot, { force: true, recursive: true });
  }
});

describe("MigrationScanner", () => {
  it("loads migrations from relative, dot-relative, absolute, and spaced directories", async () => {
    const { migrationFile, migrationsDir } = createMigrationDirectory();
    const relativeDir = relative(process.cwd(), migrationsDir);

    for (const configuredDir of [relativeDir, `.${sep}${relativeDir}`, migrationsDir]) {
      const files = await new MigrationScanner(configuredDir).scan();

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        id: "20260728000000",
        name: "initialize",
        path: migrationFile,
      });
      expect(files[0]?.up).toBeTypeOf("function");
    }
  });

  it.each([
    [
      "a dependency is missing",
      "import './missing-dependency.js';\nexport async function up() {}\n",
    ],
    ["the module has invalid syntax", "export async function up( {}\n"],
    [
      "module evaluation throws",
      "throw new Error('fixture failed');\nexport async function up() {}\n",
    ],
    ["module evaluation throws a primitive", "throw 'fixture failed';\n"],
  ])("identifies the exact migration file when %s", async (_scenario, source) => {
    const { migrationFile, migrationsDir } = createMigrationDirectory(source);
    const moduleUrl = pathToFileURL(migrationFile).href;

    await expect(new MigrationScanner(migrationsDir).scan()).rejects.toMatchObject({
      code: "migration-runner/file-load-failed",
      detail: `Failed to load migration file '${moduleUrl}'`,
      cause: expect.any(Error),
    } satisfies Partial<MigrationFileLoadProblem>);
  });

  it("loads a path containing spaces", async () => {
    const { migrationFile, migrationsDir } = createMigrationDirectory();

    const files = await new MigrationScanner(migrationsDir).scan();

    expect(files[0]?.path).toBe(migrationFile);
    expect(pathToFileURL(files[0]?.path ?? "").protocol).toBe("file:");
  });
});

function createMigrationDirectory(
  source = "export async function up() {}\nexport async function down() {}\n",
): {
  readonly migrationFile: string;
  readonly migrationsDir: string;
} {
  const tempRoot = mkdtempSync(join(process.cwd(), "migration scanner "));
  tempRoots.push(tempRoot);
  writeFileSync(join(tempRoot, "package.json"), '{"type":"module"}\n');

  const migrationsDir = join(tempRoot, "migrations with spaces");
  mkdirSync(migrationsDir);
  const migrationFile = join(migrationsDir, "20260728000000_initialize.js");
  writeFileSync(migrationFile, source);

  return { migrationFile, migrationsDir };
}

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type MigrationFixture = {
  readonly id: string;
  readonly name: string;
  readonly failUp?: boolean;
  readonly failDown?: boolean;
};

export type MigrationFixtureDirectory = {
  readonly path: string;
  readonly cleanup: () => void;
};

export function createMigrationFixtures(
  fixtures: readonly MigrationFixture[],
): MigrationFixtureDirectory {
  const path = mkdtempSync(join(tmpdir(), "croco-migration-command-e2e-"));

  for (const fixture of fixtures) {
    writeFileSync(join(path, `${fixture.id}_${fixture.name}.ts`), migrationSource(fixture));
  }

  return {
    path,
    cleanup: () => rmSync(path, { force: true, recursive: true }),
  };
}

function migrationSource(fixture: MigrationFixture): string {
  const upFailure = fixture.failUp ? `  throw new Error('up unavailable for ${fixture.id}');` : "";
  const downFailure = fixture.failDown
    ? `  throw new Error('down unavailable for ${fixture.id}');`
    : "";

  return [
    "type Database = { execute: (query: unknown) => Promise<unknown> };",
    "",
    "export async function up(db: Database): Promise<void> {",
    `  await db.execute({ kind: 'migration-body', direction: 'up', id: '${fixture.id}' });`,
    upFailure,
    "}",
    "",
    "export async function down(db: Database): Promise<void> {",
    `  await db.execute({ kind: 'migration-body', direction: 'down', id: '${fixture.id}' });`,
    downFailure,
    "}",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

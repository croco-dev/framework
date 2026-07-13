import { MigrationHistoryDriftProblem } from "./problems/MigrationHistoryDriftProblem";
import type { MigrationFile, MigrationRecord } from "./types";

type ReconciledMigrationHistory = {
  readonly executedById: ReadonlyMap<string, MigrationRecord>;
  readonly executedFiles: readonly MigrationFile[];
};

export function assertUniqueMigrationFileIds(files: readonly MigrationFile[]): void {
  const ids = new Set<string>();
  for (const file of files) {
    if (ids.has(file.id)) {
      throw new MigrationHistoryDriftProblem({
        reason: "duplicate-file-id",
        migrationId: file.id,
      });
    }
    ids.add(file.id);
  }
}

export function reconcileMigrationHistory(
  files: readonly MigrationFile[],
  executed: readonly MigrationRecord[],
): ReconciledMigrationHistory {
  assertUniqueMigrationFileIds(files);

  const fileById = new Map(files.map((file) => [file.id, file]));
  const executedById = new Map<string, MigrationRecord>();
  const executedFiles: MigrationFile[] = [];

  for (const record of executed) {
    const file = fileById.get(record.id);
    if (!file) {
      throw new MigrationHistoryDriftProblem({
        reason: "missing-file",
        migrationId: record.id,
        recordedName: record.name,
      });
    }
    if (file.name !== record.name) {
      throw new MigrationHistoryDriftProblem({
        reason: "name-mismatch",
        migrationId: record.id,
        recordedName: record.name,
        currentName: file.name,
      });
    }
    executedById.set(record.id, record);
    executedFiles.push(file);
  }

  return { executedById, executedFiles };
}

import { Problem, ProblemCategory } from "@croco/problems-core";

export type MigrationHistoryDriftReason = "duplicate-file-id" | "missing-file" | "name-mismatch";

export type MigrationHistoryDrift = {
  readonly reason: MigrationHistoryDriftReason;
  readonly migrationId: string;
  readonly recordedName?: string;
  readonly currentName?: string;
};

const RECOVERY =
  "Restore the original applied migration file with its recorded id and name, or use a separate explicit operator-controlled history repair after verifying the database state, then retry.";

export class MigrationHistoryDriftProblem extends Problem {
  readonly code = "migration-runner/history-drift";
  readonly category = ProblemCategory.Conflict;

  constructor(drift: MigrationHistoryDrift) {
    super(undefined, undefined, detailFor(drift), {
      extensions: {
        reason: drift.reason,
        migrationId: drift.migrationId,
        ...(drift.recordedName === undefined ? {} : { recordedName: drift.recordedName }),
        ...(drift.currentName === undefined ? {} : { currentName: drift.currentName }),
        recovery: RECOVERY,
      },
    });
  }
}

function detailFor(drift: MigrationHistoryDrift): string {
  if (drift.reason === "duplicate-file-id") {
    return `Migration file id '${drift.migrationId}' is duplicated`;
  }

  if (drift.reason === "missing-file") {
    return `Applied migration '${drift.migrationId}_${drift.recordedName}' has no matching file`;
  }

  return `Applied migration '${drift.migrationId}_${drift.recordedName}' does not match current file '${drift.migrationId}_${drift.currentName}'`;
}

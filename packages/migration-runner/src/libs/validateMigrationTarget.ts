import { InvalidMigrationTargetProblem } from "./problems/InvalidMigrationTargetProblem";

const MIGRATION_ID_PATTERN = /^\d{14}$/;

export function assertValidMigrationTarget(target: string): void {
  if (!MIGRATION_ID_PATTERN.test(target)) {
    throw new InvalidMigrationTargetProblem(target, "malformed");
  }
}

import { InvalidMigrationCountProblem } from "./problems/InvalidMigrationCountProblem";

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

export function parseMigrationCount(count: string): number {
  const normalized = count.trim();

  if (!POSITIVE_INTEGER_PATTERN.test(normalized)) {
    throw new InvalidMigrationCountProblem(count);
  }

  return assertValidMigrationCount(Number(normalized));
}

export function assertValidMigrationCount(count: number): number {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new InvalidMigrationCountProblem(count);
  }

  return count;
}

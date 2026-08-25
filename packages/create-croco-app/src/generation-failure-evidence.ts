export type StagingCleanupFailure = {
  readonly ok: false;
  readonly detail: string;
};

const cleanupFailures = new WeakMap<object, StagingCleanupFailure>();

export function recordStagingCleanupFailure(primaryError: unknown, cleanupError: unknown): void {
  if (
    (typeof primaryError !== "object" || primaryError === null) &&
    typeof primaryError !== "function"
  ) {
    return;
  }

  cleanupFailures.set(primaryError, {
    ok: false,
    detail: describeError(cleanupError),
  });
}

export function readStagingCleanupFailure(error: unknown): StagingCleanupFailure | undefined {
  if ((typeof error !== "object" || error === null) && typeof error !== "function") {
    return undefined;
  }

  return cleanupFailures.get(error);
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

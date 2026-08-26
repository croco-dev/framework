export type StagingCleanupFailure = {
  readonly ok: false;
  readonly detail: string;
};

const cleanupFailures = new WeakMap<object, StagingCleanupFailure>();

export function recordStagingCleanupFailure(primaryError: unknown, cleanupError: unknown): object {
  const recordedError = isWeakMapKey(primaryError)
    ? primaryError
    : new Error(describeError(primaryError));

  cleanupFailures.set(recordedError, {
    ok: false,
    detail: describeError(cleanupError),
  });

  return recordedError;
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

function isWeakMapKey(value: unknown): value is object {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

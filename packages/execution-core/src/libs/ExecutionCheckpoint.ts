import { ExecutionProblems } from "./ExecutionProblem";

export type ExecutionCheckpointValue =
  | null
  | boolean
  | number
  | string
  | readonly ExecutionCheckpointValue[]
  | { readonly [key: string]: ExecutionCheckpointValue };

export type PreparedExecutionCheckpoint = {
  readonly serialized: string;
  readonly value: ExecutionCheckpointValue;
};

/**
 * Applies the checkpoint persistence boundary shared by in-memory and durable stores.
 *
 * Values accepted by JSON are normalized to their persisted representation. Values that JSON
 * cannot represent as the requested property, including undefined, bigint, and cyclic objects,
 * fail with the stable checkpoint conformance Problem.
 */
export function prepareExecutionCheckpoint(
  key: string,
  value: unknown,
): PreparedExecutionCheckpoint {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify({ [key]: value });
  } catch {
    throwInvalidCheckpointValue(key);
  }

  if (serialized === undefined) {
    throwInvalidCheckpointValue(key);
  }

  const parsed = JSON.parse(serialized) as Record<string, ExecutionCheckpointValue>;
  if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
    throwInvalidCheckpointValue(key);
  }

  return {
    serialized,
    value: parsed[key] as ExecutionCheckpointValue,
  };
}

function throwInvalidCheckpointValue(key: string): never {
  throw ExecutionProblems.checkpointStoreConformance(
    `Checkpoint '${key}' must contain a JSON-serializable value`,
  );
}

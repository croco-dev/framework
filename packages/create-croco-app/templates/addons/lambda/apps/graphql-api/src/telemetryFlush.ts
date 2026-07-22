import { Problem, ProblemCategory } from "@croco/problems-core";
import { TelemetryForceFlushUnsupportedProblem } from "@croco/telemetry-sdk-node";
import type { ForceFlushResult } from "@croco/telemetry-sdk-node";

type OperationOutcome<T> =
  | { readonly completed: true; readonly value: T }
  | { readonly completed: false; readonly error: unknown };

class LambdaTelemetryBoundaryProblem extends Problem {
  readonly code = "create-croco-app/lambda-telemetry-boundary";
  readonly category = ProblemCategory.InternalServerError;
  readonly failures: readonly [request: unknown, flush: unknown];

  constructor(requestFailure: unknown, flushFailure: unknown) {
    super(
      "create-croco-app/lambda-telemetry-boundary",
      ProblemCategory.InternalServerError,
      "Lambda request and telemetry flush both failed.",
    );
    this.failures = [requestFailure, flushFailure];
  }
}

async function captureOperation<T>(operation: () => Promise<T>): Promise<OperationOutcome<T>> {
  try {
    return { completed: true, value: await operation() };
  } catch (error) {
    return { completed: false, error };
  }
}

async function captureFlushFailure(
  flush: () => Promise<ForceFlushResult>,
): Promise<unknown | null> {
  try {
    const result = await flush();
    if (result.outcome === "failed") {
      return result.error;
    }
    if (result.outcome === "unsupported") {
      return new TelemetryForceFlushUnsupportedProblem();
    }
    return null;
  } catch (error) {
    return error;
  }
}

export async function runWithTelemetryFlush<T>(
  operation: () => Promise<T>,
  flush: () => Promise<ForceFlushResult>,
): Promise<T> {
  const operationOutcome = await captureOperation(operation);
  const flushFailure = await captureFlushFailure(flush);

  if (!operationOutcome.completed) {
    if (flushFailure !== null) {
      throw new LambdaTelemetryBoundaryProblem(operationOutcome.error, flushFailure);
    }
    throw operationOutcome.error;
  }
  if (flushFailure !== null) {
    throw flushFailure;
  }
  return operationOutcome.value;
}

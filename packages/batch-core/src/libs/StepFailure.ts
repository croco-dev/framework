import type { ExecutionError } from "@croco/execution-core";

export type StepFailureContext = {
  executionId: string;
  stepName: string;
};

export type StepFailureClassification =
  | boolean
  | {
      retryable: boolean;
      code?: string;
    };

export type StepFailureClassifier = (
  error: unknown,
  context: StepFailureContext,
) => StepFailureClassification;

type NormalizedStepFailureClassification = {
  retryable: boolean;
  code?: string;
  classifierFailed?: boolean;
};

const FAILURE_CLASSIFICATION_FAILED_CODE = "batch-core/failure-classification-failed";

export function createStepExecutionError(
  error: unknown,
  classifier: StepFailureClassifier | undefined,
  context: StepFailureContext,
): ExecutionError {
  const err = error instanceof Error ? error : new Error(String(error));
  const classification = classifyFailure(error, classifier, context);
  const code =
    classification.code ??
    extractFailureCode(error) ??
    (classification.classifierFailed ? FAILURE_CLASSIFICATION_FAILED_CODE : undefined);

  return {
    message: err.message,
    stack: err.stack,
    retryable: classification.retryable,
    ...(code ? { code } : {}),
  };
}

function classifyFailure(
  error: unknown,
  classifier: StepFailureClassifier | undefined,
  context: StepFailureContext,
): NormalizedStepFailureClassification {
  if (!classifier) {
    return normalizeFailureClassification(undefined);
  }

  try {
    return normalizeFailureClassification(classifier(error, context));
  } catch {
    return {
      retryable: true,
      classifierFailed: true,
    };
  }
}

function normalizeFailureClassification(
  classification: StepFailureClassification | undefined,
): NormalizedStepFailureClassification {
  if (classification === undefined) {
    return { retryable: true };
  }

  if (typeof classification === "boolean") {
    return { retryable: classification };
  }

  return {
    retryable: classification.retryable,
    code: classification.code,
  };
}

function extractFailureCode(error: unknown): string | undefined {
  return extractStringProperty(error, "code") ?? extractStringProperty(error, "category");
}

function extractStringProperty(error: unknown, property: "code" | "category"): string | undefined {
  if (typeof error !== "object" || error === null || !(property in error)) {
    return undefined;
  }

  const value = (error as Record<typeof property, unknown>)[property];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

import { Problem, ProblemCategory } from "@croco/problems-core";
import type { OutboxFailureMetadata } from "../types";

export const OUTBOX_DISPATCH_PROBLEM_CODE = "outbox-core/dispatch-failed";
export const OUTBOX_FAILURE_METADATA_PROBLEM_CODE = "outbox-core/failure-metadata-missing";
export const OUTBOX_UNIT_OF_WORK_CONTEXT_PROBLEM_CODE = "outbox-core/unit-of-work-context-invalid";

export type OutboxFailureProblemExtensions = {
  readonly outboxRetryable: boolean;
  readonly outboxTerminal: boolean;
  readonly outboxAttempt: number;
  readonly outboxMaxAttempts: number;
  readonly outboxFailedAt: string;
  readonly outboxNextVisibleAt?: string;
};

export type OutboxDispatchProblemOptions = {
  readonly detail?: string;
  readonly failure: OutboxFailureMetadata;
  readonly cause?: Error;
};

export function createOutboxFailureProblemExtensions(
  failure: OutboxFailureMetadata,
): OutboxFailureProblemExtensions {
  return {
    outboxRetryable: failure.retryable,
    outboxTerminal: failure.terminal,
    outboxAttempt: failure.attempt,
    outboxMaxAttempts: failure.maxAttempts,
    outboxFailedAt: failure.failedAt.toISOString(),
    ...(failure.nextVisibleAt ? { outboxNextVisibleAt: failure.nextVisibleAt.toISOString() } : {}),
  };
}

export function readOutboxFailureMetadata(problem: Problem): OutboxFailureMetadata | null {
  const extensions = problem.extensions;
  if (!extensions) {
    return null;
  }

  const retryable = extensions.outboxRetryable;
  const terminal = extensions.outboxTerminal;
  const attempt = extensions.outboxAttempt;
  const maxAttempts = extensions.outboxMaxAttempts;
  const failedAt = extensions.outboxFailedAt;
  const nextVisibleAt = extensions.outboxNextVisibleAt;

  if (
    typeof retryable !== "boolean" ||
    typeof terminal !== "boolean" ||
    typeof attempt !== "number" ||
    typeof maxAttempts !== "number" ||
    typeof failedAt !== "string" ||
    (nextVisibleAt !== undefined && typeof nextVisibleAt !== "string")
  ) {
    return null;
  }

  const failedAtDate = parseDate(failedAt);
  const nextVisibleAtDate = nextVisibleAt === undefined ? undefined : parseDate(nextVisibleAt);

  if (!failedAtDate || (nextVisibleAt !== undefined && !nextVisibleAtDate)) {
    return null;
  }

  return {
    retryable,
    terminal,
    attempt,
    maxAttempts,
    failedAt: failedAtDate,
    ...(nextVisibleAtDate ? { nextVisibleAt: nextVisibleAtDate } : {}),
  };
}

export class OutboxDispatchProblem extends Problem {
  constructor(options: OutboxDispatchProblemOptions) {
    super(
      OUTBOX_DISPATCH_PROBLEM_CODE,
      ProblemCategory.InternalServerError,
      options.detail ?? "Outbox dispatch failed.",
      {
        cause: options.cause,
        extensions: createOutboxFailureProblemExtensions(options.failure),
      },
    );
  }
}

export class OutboxFailureMetadataProblem extends Problem {
  constructor() {
    super(
      OUTBOX_FAILURE_METADATA_PROBLEM_CODE,
      ProblemCategory.InternalServerError,
      "Outbox failure Problem is missing retryability metadata.",
    );
  }
}

export class OutboxUnitOfWorkContextProblem extends Problem {
  constructor() {
    super(
      OUTBOX_UNIT_OF_WORK_CONTEXT_PROBLEM_CODE,
      ProblemCategory.InternalServerError,
      "Outbox Unit of Work context is missing or belongs to another store.",
    );
  }
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

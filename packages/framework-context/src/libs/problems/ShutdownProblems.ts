import { Problem, ProblemCategory } from "@croco/problems-core";

export type OnShutdownDecoratorFailureReason = "static-method" | "non-method" | "multiple-methods";

/**
 * `@OnShutdown()`이 지원하지 않는 대상 또는 충돌하는 메서드 선언에 적용될 때 발생하는 Problem입니다.
 */
export class OnShutdownDecoratorProblem extends Problem {
  readonly code = "framework-context/on-shutdown-decorator-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(
    readonly reason: OnShutdownDecoratorFailureReason,
    targetName: string,
    propertyKey?: PropertyKey,
    existingPropertyKey?: PropertyKey,
  ) {
    const normalizedPropertyKey = propertyKey === undefined ? undefined : String(propertyKey);
    const normalizedExistingPropertyKey =
      existingPropertyKey === undefined ? undefined : String(existingPropertyKey);

    super(
      "framework-context/on-shutdown-decorator-invalid",
      ProblemCategory.ValidationError,
      onShutdownDecoratorProblemDetail(
        reason,
        targetName,
        normalizedPropertyKey,
        normalizedExistingPropertyKey,
      ),
      {
        extensions: {
          reason,
          targetName,
          ...(normalizedPropertyKey === undefined ? {} : { propertyKey: normalizedPropertyKey }),
          ...(normalizedExistingPropertyKey === undefined
            ? {}
            : { existingPropertyKey: normalizedExistingPropertyKey }),
        },
      },
    );
  }
}

function onShutdownDecoratorProblemDetail(
  reason: OnShutdownDecoratorFailureReason,
  targetName: string,
  propertyKey?: string,
  existingPropertyKey?: string,
): string {
  const target = propertyKey === undefined ? targetName : `${targetName}.${propertyKey}`;

  switch (reason) {
    case "static-method":
      return `@OnShutdown() does not support static method '${target}'.`;
    case "non-method":
      return `@OnShutdown() can decorate only classes or instance methods; received '${target}'.`;
    case "multiple-methods":
      return `@OnShutdown() supports one instance method per class; '${target}' conflicts with '${targetName}.${existingPropertyKey}'.`;
    default:
      return assertNever(reason);
  }
}

function assertNever(value: never): never {
  throw new OnShutdownDecoratorProblem("non-method", String(value));
}

/** Shutdown timeout configuration must be a finite positive duration. */
export class InvalidShutdownTimeoutProblem extends Problem {
  readonly code = "framework-context/shutdown-timeout-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(readonly timeoutMs: number) {
    super(
      undefined,
      undefined,
      `Shutdown timeout must be a finite positive duration; received ${String(timeoutMs)}ms`,
    );
  }
}

/**
 * graceful shutdown이 제한 시간을 넘겼을 때 발생하는 Problem입니다.
 */
export class ShutdownTimeoutProblem extends Problem {
  readonly code = "framework-context/shutdown-timeout";
  readonly category = ProblemCategory.InternalServerError;
  constructor(timeoutMs: number, failures: readonly Error[] = []) {
    super(undefined, undefined, `Shutdown timeout exceeded after ${timeoutMs}ms`, {
      extensions: {
        timeoutMs,
        ...(failures.length === 0
          ? {}
          : {
              hookFailureCount: failures.length,
              hookFailures: failures.map((failure) => ({
                message: failure.message,
                name: failure.name,
              })),
            }),
      },
    });
  }
}

/**
 * shutdown manager singleton에 서로 다른 명시적 설정이 적용될 때 발생하는 Problem입니다.
 */
export class ShutdownConfigurationConflictProblem extends Problem {
  readonly code = "framework-context/shutdown-configuration-conflict";
  readonly category = ProblemCategory.Conflict;
  constructor(currentTimeoutMs: number, requestedTimeoutMs: number) {
    super(
      undefined,
      undefined,
      `ShutdownManager is already configured with timeout ${currentTimeoutMs}ms; received conflicting timeout ${requestedTimeoutMs}ms`,
    );
  }
}

/**
 * shutdown hook failures must be surfaced to lifecycle owners that request strict cleanup evidence.
 */
export class ShutdownHookExecutionProblem extends Problem {
  readonly code = "framework-context/shutdown-hook-execution-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(failures: readonly Error[]) {
    super(
      "framework-context/shutdown-hook-execution-failed",
      ProblemCategory.InternalServerError,
      `${failures.length} shutdown hook(s) failed.`,
      {
        extensions: {
          failureCount: failures.length,
          failures: failures.map((failure) => ({
            message: failure.message,
            name: failure.name,
          })),
        },
      },
    );
  }
}

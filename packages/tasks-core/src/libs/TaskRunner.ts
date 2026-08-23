import { ExecutionProblems } from "@croco/execution-core";
import type {
  Execution,
  ExecutionAttemptManager,
  ExecutionAttemptToken,
  ExecutionManager,
} from "@croco/execution-core";
import type { ILogger } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { Problem } from "@croco/problems-core";
import { recordError } from "@croco/telemetry-api";
import {
  TaskExecutionTimeoutProblem,
  TaskNotFoundProblem,
  TaskRunnerDIFailureProblem,
} from "./problems/TasksProblems";
import { TaskRegistry } from "./TaskRegistry";
import type { TaskExecutionContext, TaskExecutionOptions, TaskTimeoutRetryPolicy } from "./types";

type Constructor<T = object> = new (...args: unknown[]) => T;

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export interface TaskRunnerRuntime {
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, delayMs: number) => () => void;
}

const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

async function resolveExecutionIdempotency(
  taskId: string,
  taskIdempotencyKey?: string,
  executionIdempotencyKey?: string,
): Promise<{ idempotencyKey?: string; legacyIdempotencyKeys?: readonly string[] }> {
  const legacyKey =
    executionIdempotencyKey === undefined
      ? taskIdempotencyKey
      : taskIdempotencyKey === undefined
        ? executionIdempotencyKey
        : `${executionIdempotencyKey}:task:${taskIdempotencyKey}`;
  if (legacyKey === undefined) return {};

  const scope = JSON.stringify({
    configuredKey: taskIdempotencyKey ?? null,
    executionKey: executionIdempotencyKey ?? null,
    taskId,
    version: 2,
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(scope));
  const fingerprint = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    idempotencyKey: `task:v2:${fingerprint}`,
    legacyIdempotencyKeys: [legacyKey],
  };
}

function normalizeThrownError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isTaskErrorRetryable(error: Error): boolean {
  if ("retryable" in error) {
    return Boolean(error.retryable);
  }

  return error instanceof Problem && error.extensions?.retryable === true;
}

class TaskFailureRecordingAggregateError extends Error {
  readonly errors: readonly unknown[];

  constructor(errors: readonly unknown[]) {
    super("Task failure includes execution failure-recording evidence");
    this.name = "TaskFailureRecordingAggregateError";
    this.errors = errors;
  }
}

function attachFailureRecordingCause(taskError: Error, recordingError: unknown): void {
  try {
    const existingCause = (taskError as Error & { cause?: unknown }).cause;
    const diagnosticCause =
      existingCause === undefined
        ? normalizeThrownError(recordingError)
        : new TaskFailureRecordingAggregateError([existingCause, recordingError]);
    Object.defineProperty(taskError, "cause", {
      value: diagnosticCause,
      configurable: true,
    });
  } catch {
    return;
  }
}

function recordDiagnosticError(error: unknown): void {
  try {
    recordError(error);
  } catch {
    return;
  }
}

function supportsAttemptFencing(
  manager: ExecutionManager,
): manager is ExecutionManager & ExecutionAttemptManager {
  const candidate = manager as ExecutionManager & Partial<ExecutionAttemptManager>;
  return (
    typeof candidate.supportsAttemptFencing === "function" &&
    candidate.supportsAttemptFencing() &&
    typeof candidate.completeAttempt === "function" &&
    typeof candidate.failAttempt === "function" &&
    typeof candidate.timeoutAttempt === "function" &&
    typeof candidate.settleTimedOutAttempt === "function" &&
    typeof candidate.resolveIndeterminateTimeout === "function"
  );
}

export class TaskRunner {
  private readonly now: () => number;
  private readonly schedule: (callback: () => void, delayMs: number) => () => void;

  constructor(
    private executionManager: ExecutionManager,
    private registry: TaskRegistry = TaskRegistry.fromMetadata(),
    private logger: ILogger = noopLogger,
    runtime: TaskRunnerRuntime = {},
  ) {
    this.now = runtime.now ?? (() => Date.now());
    this.schedule =
      runtime.schedule ??
      ((callback, delayMs) => {
        const timeout = setTimeout(callback, delayMs);
        return () => clearTimeout(timeout);
      });
  }

  async execute(
    taskId: string,
    payload: unknown,
    options: TaskExecutionOptions = {},
  ): Promise<unknown> {
    const task = this.registry.get(taskId);
    if (!task) {
      throw new TaskNotFoundProblem(taskId);
    }

    const taskOptions = task.metadata.options ?? {};
    const idempotency = await resolveExecutionIdempotency(
      taskId,
      taskOptions.idempotencyKey,
      options.idempotencyKey,
    );
    const execution = await this.executionManager.create({
      type: taskId,
      payload,
      maxAttempts: taskOptions.maxAttempts,
      timeout: taskOptions.timeout,
      idempotencyKey: idempotency.idempotencyKey,
      ...(idempotency.legacyIdempotencyKeys === undefined
        ? {}
        : { legacyIdempotencyKeys: idempotency.legacyIdempotencyKeys }),
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    });

    if (execution.status === "completed") {
      return execution.result;
    }

    return this.runExecution(task.target, task.methodName, execution, taskOptions.timeoutRetry);
  }

  async retry(executionId: string): Promise<unknown> {
    const execution = await this.executionManager.get(executionId);
    const task = this.registry.get(execution.type);
    if (!task) {
      throw new TaskNotFoundProblem(execution.type);
    }

    if (execution.status === "timed_out" && execution.error?.indeterminate === true) {
      throw ExecutionProblems.indeterminateRetryBlocked(
        `Execution '${executionId}' timed out with an indeterminate outcome; inspect external effects and use recoverTimeout for operator recovery`,
      );
    }

    const retryingExecution = await this.executionManager.retry(executionId);
    return this.runExecution(
      task.target,
      task.methodName,
      retryingExecution,
      task.metadata.options?.timeoutRetry,
    );
  }

  /**
   * Records operator recovery for an indeterminate timeout and retries the execution.
   *
   * The reason is retained as audit metadata. Inspect external effects first, then call this method;
   * retry() remains blocked until the attempt-fenced recovery record has been committed.
   */
  async recoverTimeout(executionId: string, reason: string): Promise<unknown> {
    if (!supportsAttemptFencing(this.executionManager)) {
      throw ExecutionProblems.attemptFencingUnsupported(
        `Execution manager cannot recover indeterminate timeout '${executionId}' without atomic attempt fencing`,
      );
    }

    const execution = await this.executionManager.get(executionId);
    await this.executionManager.resolveIndeterminateTimeout(
      { executionId, attempt: execution.attempts },
      reason,
    );
    return this.retry(executionId);
  }

  private async runExecution(
    target: object,
    methodName: string | symbol,
    execution: Execution,
    timeoutRetryPolicy?: TaskTimeoutRetryPolicy,
  ): Promise<unknown> {
    const hasEnforcedTimeout = execution.timeout !== undefined && execution.timeout > 0;
    const attemptManager: ExecutionAttemptManager | undefined =
      hasEnforcedTimeout && supportsAttemptFencing(this.executionManager)
        ? this.executionManager
        : undefined;
    if (hasEnforcedTimeout && !attemptManager) {
      throw ExecutionProblems.attemptFencingUnsupported(
        `Timed task execution '${execution.id}' requires an execution manager with atomic attempt fencing`,
      );
    }

    const startedExecution = await this.executionManager.start(execution.id);
    const attemptToken: ExecutionAttemptToken = {
      executionId: startedExecution.id,
      attempt: startedExecution.attempts,
    };
    const controller = new AbortController();
    const context: TaskExecutionContext = {
      executionId: startedExecution.id,
      attempt: startedExecution.attempts,
      attemptToken,
      signal: controller.signal,
    };
    const timeoutMs = startedExecution.timeout;
    const deadline =
      timeoutMs !== undefined && timeoutMs > 0 && startedExecution.startedAt !== undefined
        ? startedExecution.startedAt.getTime() + timeoutMs
        : undefined;
    const timeoutProblem =
      deadline === undefined || timeoutMs === undefined
        ? undefined
        : new TaskExecutionTimeoutProblem(
            startedExecution.id,
            timeoutMs,
            timeoutRetryPolicy === "idempotent" || timeoutRetryPolicy === "fenced",
          );
    const declaredOverlapSafe =
      timeoutRetryPolicy === "idempotent" || timeoutRetryPolicy === "fenced";
    let timeoutClaimed = false;
    let handlerSettled = false;
    let settlementScheduled = false;
    let handlerPromise: Promise<unknown> | undefined;
    let timeoutCommit: Promise<Execution> | undefined;
    let cancelTimeout: (() => void) | undefined;
    let triggerTimeout: (() => void) | undefined;
    const settleTimedOutAttempt = (): void => {
      handlerSettled = true;
      if (
        !attemptManager ||
        declaredOverlapSafe ||
        !timeoutClaimed ||
        timeoutCommit === undefined ||
        settlementScheduled
      ) {
        return;
      }
      settlementScheduled = true;
      void timeoutCommit
        .then(() => attemptManager.settleTimedOutAttempt(attemptToken))
        .catch((error: unknown) => {
          if (
            typeof error !== "object" ||
            error === null ||
            !("code" in error) ||
            error.code !== "execution/attempt-fence-conflict"
          ) {
            recordDiagnosticError(error);
          }
        });
    };
    const timeoutPromise =
      timeoutProblem === undefined || deadline === undefined
        ? undefined
        : new Promise<never>((_resolve, reject) => {
            triggerTimeout = () => {
              if (timeoutClaimed) return;
              timeoutClaimed = true;
              timeoutCommit = this.claimTimeout(
                attemptManager,
                attemptToken,
                declaredOverlapSafe || handlerPromise === undefined,
              );
              if (handlerSettled) settleTimedOutAttempt();
              controller.abort(timeoutProblem);
              void timeoutCommit.then(
                (timedOut) =>
                  reject(
                    new TaskExecutionTimeoutProblem(
                      startedExecution.id,
                      timeoutProblem.timeoutMs,
                      timedOut.error?.retryable === true,
                    ),
                  ),
                reject,
              );
            };
            const scheduleTimeout = () => {
              const remaining = deadline - this.now();
              if (remaining <= 0) {
                triggerTimeout?.();
                return;
              }

              cancelTimeout = this.schedule(
                scheduleTimeout,
                Math.min(remaining, MAX_TIMER_DELAY_MS),
              );
            };
            scheduleTimeout();
          });

    try {
      const instance = this.createInstance(target) as Record<string | symbol, unknown>;
      if (deadline !== undefined && this.now() >= deadline) {
        triggerTimeout?.();
        return await timeoutPromise;
      }

      const method = instance[methodName] as (
        payload: unknown,
        context: TaskExecutionContext,
      ) => unknown;
      handlerPromise = Promise.resolve().then(() =>
        method.call(instance, startedExecution.payload, context),
      );
      if (attemptManager && !declaredOverlapSafe) {
        void handlerPromise.then(settleTimedOutAttempt, settleTimedOutAttempt);
      }
      const result = await (timeoutPromise
        ? Promise.race([handlerPromise, timeoutPromise])
        : handlerPromise);

      if (deadline !== undefined && this.now() >= deadline) {
        triggerTimeout?.();
        return await timeoutPromise;
      }

      cancelTimeout?.();

      try {
        if (attemptManager) {
          await attemptManager.completeAttempt(attemptToken, result);
        } else {
          await this.executionManager.complete(startedExecution.id, result);
        }
      } catch (error) {
        const current = await this.executionManager.get(startedExecution.id);
        if (current.status === "timed_out" && timeoutProblem !== undefined) {
          throw new TaskExecutionTimeoutProblem(
            startedExecution.id,
            timeoutProblem.timeoutMs,
            current.error?.retryable === true,
          );
        }
        throw error;
      }
      return result;
    } catch (error) {
      cancelTimeout?.();
      if (timeoutClaimed && timeoutPromise !== undefined) {
        return await timeoutPromise;
      }

      if (error instanceof TaskExecutionTimeoutProblem) {
        throw error;
      }

      if (deadline !== undefined && this.now() >= deadline && triggerTimeout !== undefined) {
        triggerTimeout();
        return await timeoutPromise;
      }

      const taskError = normalizeThrownError(error);
      const executionError = {
        message: taskError.message,
        retryable: isTaskErrorRetryable(taskError),
        code: "code" in taskError ? String(taskError.code) : undefined,
        stack: taskError.stack,
      };

      try {
        if (attemptManager) {
          await attemptManager.failAttempt(attemptToken, executionError);
        } else {
          await this.executionManager.fail(startedExecution.id, executionError);
        }
      } catch (transitionError) {
        let current: Execution;
        try {
          current = await this.executionManager.get(startedExecution.id);
        } catch (reconciliationError) {
          this.reportFailureRecordingError(
            startedExecution.id,
            taskError,
            transitionError,
            reconciliationError,
          );
          throw taskError;
        }
        if (current.status === "timed_out" && timeoutProblem !== undefined) {
          throw new TaskExecutionTimeoutProblem(
            startedExecution.id,
            timeoutProblem.timeoutMs,
            current.error?.retryable === true,
          );
        }
        this.reportFailureRecordingError(startedExecution.id, taskError, transitionError);
        throw taskError;
      }
      throw taskError;
    }
  }

  private reportFailureRecordingError(
    executionId: string,
    taskError: Error,
    recordingError: unknown,
    reconciliationError?: unknown,
  ): void {
    attachFailureRecordingCause(taskError, recordingError);

    try {
      this.logger.error("Failed to record task execution failure", {
        executionId,
        taskError,
        recordingError,
        ...(reconciliationError === undefined ? {} : { reconciliationError }),
      });
    } catch (loggingError) {
      recordDiagnosticError(loggingError);
    }

    for (const diagnosticError of [recordingError, reconciliationError]) {
      if (diagnosticError === undefined) continue;
      recordDiagnosticError(diagnosticError);
    }
  }

  private async claimTimeout(
    attemptManager: ExecutionAttemptManager | undefined,
    attemptToken: ExecutionAttemptToken,
    retryable: boolean,
  ): Promise<Execution> {
    if (!attemptManager) {
      throw ExecutionProblems.attemptFencingUnsupported(
        `Timed task execution '${attemptToken.executionId}' requires an execution manager with atomic attempt fencing`,
      );
    }

    try {
      return await attemptManager.timeoutAttempt(attemptToken, { retryable });
    } catch (error) {
      const current = await this.executionManager.get(attemptToken.executionId);
      if (current.status === "timed_out") {
        return current;
      }
      throw error;
    }
  }

  private createInstance(target: object): object {
    if (typeof target === "function") {
      try {
        return Container.get(target as Constructor<object>);
      } catch (error) {
        const targetName = target.name || "Unknown";
        this.logger.warn("DI resolution failed while creating task instance", {
          target: targetName,
          error: error instanceof Error ? error.message : String(error),
        });
        recordError(error);
        throw new TaskRunnerDIFailureProblem(
          targetName,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    return target;
  }
}

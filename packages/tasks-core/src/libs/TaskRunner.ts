import type { Execution, ExecutionManager } from "@croco/execution-core";
import type { ILogger } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { recordError } from "@croco/telemetry-api";
import {
  TaskExecutionTimeoutProblem,
  TaskNotFoundProblem,
  TaskRunnerDIFailureProblem,
} from "./problems/TasksProblems";
import { TaskRegistry } from "./TaskRegistry";
import type { TaskExecutionContext, TaskExecutionOptions } from "./types";

type Constructor<T = object> = new (...args: unknown[]) => T;

const MAX_TIMER_DELAY_MS = 2_147_483_647;

const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

function resolveExecutionIdempotencyKey(
  taskIdempotencyKey?: string,
  executionIdempotencyKey?: string,
): string | undefined {
  if (executionIdempotencyKey === undefined) {
    return taskIdempotencyKey;
  }

  if (taskIdempotencyKey === undefined) {
    return executionIdempotencyKey;
  }

  return `${executionIdempotencyKey}:task:${taskIdempotencyKey}`;
}

export class TaskRunner {
  constructor(
    private executionManager: ExecutionManager,
    private registry: TaskRegistry = TaskRegistry.fromMetadata(),
    private logger: ILogger = noopLogger,
  ) {}

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
    const execution = await this.executionManager.create({
      type: taskId,
      payload,
      maxAttempts: taskOptions.maxAttempts,
      timeout: taskOptions.timeout,
      idempotencyKey: resolveExecutionIdempotencyKey(
        taskOptions.idempotencyKey,
        options.idempotencyKey,
      ),
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    });

    if (execution.status === "completed") {
      return execution.result;
    }

    return this.runExecution(task.target, task.methodName, execution);
  }

  async retry(executionId: string): Promise<unknown> {
    const execution = await this.executionManager.get(executionId);
    const task = this.registry.get(execution.type);
    if (!task) {
      throw new TaskNotFoundProblem(execution.type);
    }

    const retryingExecution = await this.executionManager.retry(executionId);
    return this.runExecution(task.target, task.methodName, retryingExecution);
  }

  private async runExecution(
    target: object,
    methodName: string | symbol,
    execution: Execution,
  ): Promise<unknown> {
    const startedExecution = await this.executionManager.start(execution.id);
    const controller = new AbortController();
    const context: TaskExecutionContext = {
      executionId: startedExecution.id,
      attempt: startedExecution.attempts,
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
        : new TaskExecutionTimeoutProblem(startedExecution.id, timeoutMs);
    let timeoutClaimed = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let triggerTimeout: (() => void) | undefined;
    const timeoutPromise =
      timeoutProblem === undefined || deadline === undefined
        ? undefined
        : new Promise<never>((_resolve, reject) => {
            triggerTimeout = () => {
              if (timeoutClaimed) return;
              timeoutClaimed = true;
              controller.abort(timeoutProblem);
              void this.claimTimeout(startedExecution.id).then(
                () => reject(timeoutProblem),
                reject,
              );
            };
            const scheduleTimeout = () => {
              const remaining = deadline - Date.now();
              if (remaining <= 0) {
                triggerTimeout?.();
                return;
              }

              timeoutHandle = setTimeout(scheduleTimeout, Math.min(remaining, MAX_TIMER_DELAY_MS));
            };
            scheduleTimeout();
          });

    try {
      const instance = this.createInstance(target) as Record<string | symbol, unknown>;
      if (deadline !== undefined && Date.now() >= deadline) {
        triggerTimeout?.();
        return await timeoutPromise;
      }

      const method = instance[methodName] as (
        payload: unknown,
        context: TaskExecutionContext,
      ) => unknown;
      const handlerPromise = Promise.resolve().then(() =>
        method.call(instance, startedExecution.payload, context),
      );
      const result = await (timeoutPromise
        ? Promise.race([handlerPromise, timeoutPromise])
        : handlerPromise);

      if (deadline !== undefined && Date.now() >= deadline) {
        triggerTimeout?.();
        return await timeoutPromise;
      }

      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);

      try {
        await this.executionManager.complete(startedExecution.id, result);
      } catch (error) {
        const current = await this.executionManager.get(startedExecution.id);
        if (current.status === "timed_out" && timeoutProblem !== undefined) {
          throw timeoutProblem;
        }
        throw error;
      }
      return result;
    } catch (error) {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      if (timeoutClaimed && timeoutPromise !== undefined) {
        return await timeoutPromise;
      }

      if (error instanceof TaskExecutionTimeoutProblem) {
        throw error;
      }

      if (deadline !== undefined && Date.now() >= deadline && triggerTimeout !== undefined) {
        triggerTimeout();
        return await timeoutPromise;
      }

      const executionError = {
        message: error instanceof Error ? error.message : String(error),
        retryable:
          error instanceof Error && "retryable" in error ? Boolean(error.retryable) : false,
        code: error instanceof Error && "code" in error ? String(error.code) : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      };

      try {
        await this.executionManager.fail(startedExecution.id, executionError);
      } catch (transitionError) {
        const current = await this.executionManager.get(startedExecution.id);
        if (current.status === "timed_out" && timeoutProblem !== undefined) {
          throw timeoutProblem;
        }
        throw transitionError;
      }
      throw error;
    }
  }

  private async claimTimeout(executionId: string): Promise<void> {
    try {
      await this.executionManager.timeout(executionId);
    } catch (error) {
      const current = await this.executionManager.get(executionId);
      if (current.status === "timed_out") {
        return;
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

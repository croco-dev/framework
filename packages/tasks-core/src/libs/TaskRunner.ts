import type { ExecutionManager } from "@croco/execution-core";
import type { ILogger } from "@croco/framework-context";
import { Container } from "@croco/framework-context";
import { recordError } from "@croco/telemetry-api";
import { TaskNotFoundProblem, TaskRunnerDIFailureProblem } from "./problems/TasksProblems";
import { TaskRegistry } from "./TaskRegistry";
import type { TaskExecutionOptions } from "./types";

type Constructor<T = object> = new (...args: unknown[]) => T;

const noopLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

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
      idempotencyKey: taskOptions.idempotencyKey,
      ...(options.parentId !== undefined ? { parentId: options.parentId } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    });

    await this.executionManager.start(execution.id);

    try {
      const instance = this.createInstance(task.target) as Record<string, unknown>;
      const method = instance[task.methodName] as (payload: unknown) => unknown;
      const result = await method.call(instance, payload);

      await this.executionManager.complete(execution.id, result);
      return result;
    } catch (error) {
      const executionError = {
        message: error instanceof Error ? error.message : String(error),
        retryable:
          error instanceof Error && "retryable" in error ? Boolean(error.retryable) : false,
        code: error instanceof Error && "code" in error ? String(error.code) : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      };

      await this.executionManager.fail(execution.id, executionError);
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

import type { ExecutionManager } from '@croco/execution-core';
import type { ILogger } from '@croco/framework-context';
import { Container } from '@croco/framework-context';
import { TaskDIResolutionProblem, TaskNotFoundProblem } from './problems/TasksProblems';
import { TaskRegistry } from './TaskRegistry';

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
    private logger: ILogger = noopLogger
  ) {}

  async execute(taskId: string, payload: unknown): Promise<unknown> {
    const task = this.registry.get(taskId);
    if (!task) {
      throw new TaskNotFoundProblem(taskId);
    }

    const options = task.metadata.options ?? {};
    const execution = await this.executionManager.create({
      type: taskId,
      payload,
      maxAttempts: options.maxAttempts,
      timeout: options.timeout,
      idempotencyKey: options.idempotencyKey,
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
        retryable: error instanceof Error && 'retryable' in error ? Boolean(error.retryable) : false,
        code: error instanceof Error && 'code' in error ? String(error.code) : undefined,
        stack: error instanceof Error ? error.stack : undefined,
      };

      await this.executionManager.fail(execution.id, executionError);
      throw error;
    }
  }

  private createInstance(target: object): object {
    if (typeof target === 'function') {
      const targetName = target.name || 'Unknown';
      try {
        return Container.get(target as Constructor<object>);
      } catch (error) {
        const wrappedError = error instanceof Error ? error : new Error(String(error));
        throw new TaskDIResolutionProblem(targetName, wrappedError);
      }
    }
    return target;
  }
}

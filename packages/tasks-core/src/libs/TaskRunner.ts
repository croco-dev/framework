import type { ExecutionManager } from '@croco/execution-core';
import { TaskRegistry } from './TaskRegistry';

export class TaskRunner {
  constructor(private executionManager: ExecutionManager) {
    this.registry = TaskRegistry.getInstance();
  }

  private registry: TaskRegistry;

  async execute(taskId: string, payload: unknown): Promise<unknown> {
    const task = this.registry.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
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
      return new (target as new () => object)();
    }
    return target;
  }
}

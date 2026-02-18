import type { ExecutionManager } from '@croco/execution-core';
import { MetadataStorage } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TASK_METADATA_KEY, Task } from '../libs/decorators/Task';
import { TaskRegistry } from '../libs/TaskRegistry';
import { TaskRunner } from '../libs/TaskRunner';
import type { TaskMetadata } from '../libs/types';

describe('TaskRunner', () => {
  let mockExecutionManager: ExecutionManager;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testClassInstance: any;

  beforeEach(() => {
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();

    mockExecutionManager = {
      create: vi.fn().mockResolvedValue({
        id: 'exec-123',
        type: 'test-task',
        payload: { data: 'test' },
        status: 'pending',
        createdAt: new Date(),
      }),
      start: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      retry: vi.fn().mockResolvedValue(undefined),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      checkpoint: vi.fn().mockResolvedValue(undefined),
      timeout: vi.fn().mockResolvedValue(undefined),
    };

    class TestTaskHandler {
      @Task({ name: 'test-task' })
      async handle(payload: { data: string }): Promise<string> {
        return `processed: ${payload.data}`;
      }

      @Task({ name: 'failing-task', maxAttempts: 3 })
      async fail(payload: unknown): Promise<string> {
        throw new Error('Task failed');
      }
    }

    testClassInstance = new TestTaskHandler();
    TaskRegistry.getInstance().collectFromMetadata();
  });

  it('should execute task and return result', async () => {
    const runner = new TaskRunner(mockExecutionManager);

    const result = await runner.execute('test-task', { data: 'test' });

    expect(result).toBe('processed: test');
    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: 'test-task',
      payload: { data: 'test' },
      maxAttempts: undefined,
      timeout: undefined,
      idempotencyKey: undefined,
    });
    expect(mockExecutionManager.start).toHaveBeenCalledWith('exec-123');
    expect(mockExecutionManager.complete).toHaveBeenCalledWith('exec-123', 'processed: test');
  });

  it('should pass task options to execution manager', async () => {
    const runner = new TaskRunner(mockExecutionManager);

    await expect(runner.execute('failing-task', { test: 'data' })).rejects.toThrow('Task failed');

    expect(mockExecutionManager.create).toHaveBeenCalledWith({
      type: 'failing-task',
      payload: { test: 'data' },
      maxAttempts: 3,
      timeout: undefined,
      idempotencyKey: undefined,
    });
  });

  it('should throw error for non-existent task', async () => {
    const runner = new TaskRunner(mockExecutionManager);

    await expect(runner.execute('non-existent-task', {})).rejects.toThrow('Task not found: non-existent-task');
  });

  it('should handle task execution failure', async () => {
    const runner = new TaskRunner(mockExecutionManager);

    await expect(runner.execute('failing-task', {})).rejects.toThrow('Task failed');

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      'exec-123',
      expect.objectContaining({
        message: 'Task failed',
        retryable: false,
      })
    );
  });

  it('should extract retryable flag from error', async () => {
    class RetryableTaskHandler {
      @Task({ name: 'retryable-fail' })
      async failWithRetryable(): Promise<string> {
        const error = new Error('Retryable error') as Error & { retryable: boolean };
        error.retryable = true;
        throw error;
      }
    }

    const handlerInstance = new RetryableTaskHandler();
    const registry = TaskRegistry.getInstance();
    registry.register(
      'retryable-fail',
      RetryableTaskHandler,
      'failWithRetryable',
      registry.get('retryable-fail')?.metadata ??
        ({
          name: 'retryable-fail',
          target: RetryableTaskHandler,
          methodName: 'failWithRetryable',
        } as TaskMetadata)
    );

    const runner = new TaskRunner(mockExecutionManager);

    await expect(runner.execute('retryable-fail', {})).rejects.toThrow('Retryable error');

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      'exec-123',
      expect.objectContaining({
        message: 'Retryable error',
        retryable: true,
      })
    );
  });

  it('should extract code from error', async () => {
    class TaskWithCodeError {
      @Task({ name: 'code-error-task' })
      async failWithCode(): Promise<string> {
        const error = new Error('Error with code') as Error & { code: string };
        error.code = 'ERR_CUSTOM';
        throw error;
      }
    }

    const handlerInstance = new TaskWithCodeError();
    const registry = TaskRegistry.getInstance();

    registry.register(
      'code-error-task',
      TaskWithCodeError,
      'failWithCode',
      registry.get('code-error-task')?.metadata ??
        ({
          name: 'code-error-task',
          target: TaskWithCodeError,
          methodName: 'failWithCode',
        } as TaskMetadata)
    );

    const runner = new TaskRunner(mockExecutionManager);

    await expect(runner.execute('code-error-task', {})).rejects.toThrow('Error with code');

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      'exec-123',
      expect.objectContaining({
        code: 'ERR_CUSTOM',
      })
    );
  });

  it('should create new instance for class constructors', async () => {
    class StatelessTaskHandler {
      @Task({ name: 'stateless-task' })
      async process(payload: { value: number }): Promise<number> {
        return payload.value * 2;
      }
    }

    TaskRegistry.getInstance().collectFromMetadata();
    const runner = new TaskRunner(mockExecutionManager);

    const result = await runner.execute('stateless-task', { value: 21 });

    expect(result).toBe(42);
  });

  it('should handle non-Error objects in error handling', async () => {
    class NonErrorTaskHandler {
      @Task({ name: 'non-error-task' })
      async throwString(): Promise<string> {
        throw 'String error';
      }
    }

    const handlerInstance = new NonErrorTaskHandler();
    const registry = TaskRegistry.getInstance();

    registry.register(
      'non-error-task',
      NonErrorTaskHandler,
      'throwString',
      registry.get('non-error-task')?.metadata ??
        ({
          name: 'non-error-task',
          target: NonErrorTaskHandler,
          methodName: 'throwString',
        } as TaskMetadata)
    );

    const runner = new TaskRunner(mockExecutionManager);

    await expect(runner.execute('non-error-task', {})).rejects.toThrow('String error');

    expect(mockExecutionManager.fail).toHaveBeenCalledWith(
      'exec-123',
      expect.objectContaining({
        message: 'String error',
      })
    );
  });
});

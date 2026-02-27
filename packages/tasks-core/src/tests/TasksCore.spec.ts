import { describe, expect, it } from 'vitest';
import { TASK_METADATA_KEY, Task } from '../libs/decorators/Task';
import { TaskRegistry } from '../libs/TaskRegistry';
import { TaskRunner } from '../libs/TaskRunner';
import type { TaskMetadata, TaskOptions, TaskReference } from '../libs/types';

describe('@croco/tasks-core package exports', () => {
  it('should export Task decorator', () => {
    expect(Task).not.toBeUndefined();
    expect(typeof Task).toBe('function');
  });

  it('should export TASK_METADATA_KEY symbol', () => {
    expect(TASK_METADATA_KEY).not.toBeUndefined();
    expect(typeof TASK_METADATA_KEY).toBe('symbol');
  });

  it('should export TaskRegistry class', () => {
    expect(TaskRegistry).not.toBeUndefined();
    expect(typeof TaskRegistry).toBe('function');
    expect(typeof TaskRegistry.getInstance).toBe('function');
  });

  it('should export TaskRunner class', () => {
    expect(TaskRunner).not.toBeUndefined();
    expect(typeof TaskRunner).toBe('function');
  });

  it('should export RegisteredTask type', () => {
    const typeCheck: TaskReference = {
      name: 'test-task',
      target: class Test {},
      methodName: 'testMethod',
    };
    expect(typeCheck).not.toBeUndefined();
  });

  it('should export TaskMetadata type', () => {
    const typeCheck: TaskMetadata = {
      name: 'test-task',
      target: class Test {},
      methodName: 'testMethod',
    };
    expect(typeCheck).not.toBeUndefined();
  });

  it('should export TaskOptions type', () => {
    const typeCheck: TaskOptions = {
      name: 'custom-name',
      maxAttempts: 3,
      timeout: 5000,
      idempotencyKey: 'unique-key',
    };
    expect(typeCheck).not.toBeUndefined();
  });

  it('should export TaskReference type', () => {
    const typeCheck: TaskReference = {
      name: 'test-task',
      target: class Test {},
      methodName: 'testMethod',
    };
    expect(typeCheck).not.toBeUndefined();
  });
});

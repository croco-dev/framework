import { MetadataStorage } from '@croco/framework-context';
import { beforeEach, describe, expect, it } from 'vitest';
import { TASK_METADATA_KEY, Task } from '../libs/decorators/Task';
import { TaskRegistry } from '../libs/TaskRegistry';
import type { TaskMetadata } from '../libs/types';

describe('TaskRegistry', () => {
  beforeEach(() => {
    MetadataStorage.clear();
    TaskRegistry.getInstance().reset();
  });

  it('should be a singleton', () => {
    const instance1 = TaskRegistry.getInstance();
    const instance2 = TaskRegistry.getInstance();

    expect(instance1).toBe(instance2);
  });

  it('should register task manually', () => {
    class TestTaskHandler {
      async handle(payload: unknown): Promise<string> {
        return 'done';
      }
    }

    const metadata: TaskMetadata = {
      name: 'manual-task',
      target: TestTaskHandler,
      methodName: 'handle',
    };

    TaskRegistry.getInstance().register('manual-task', TestTaskHandler, 'handle', metadata);

    expect(TaskRegistry.getInstance().has('manual-task')).toBe(true);
  });

  it('should retrieve registered task', () => {
    class TestTaskHandler {
      async process(payload: unknown): Promise<void> {}
    }

    const metadata: TaskMetadata = {
      name: 'retrievable-task',
      target: TestTaskHandler,
      methodName: 'process',
    };

    TaskRegistry.getInstance().register('retrievable-task', TestTaskHandler, 'process', metadata);

    const task = TaskRegistry.getInstance().get('retrievable-task');

    expect(task).toBeDefined();
    expect(task?.name).toBe('retrievable-task');
    expect(task?.target).toBe(TestTaskHandler);
    expect(task?.methodName).toBe('process');
  });

  it('should return undefined for non-existent task', () => {
    const task = TaskRegistry.getInstance().get('non-existent-task');
    expect(task).toBeUndefined();
  });

  it('should return all registered tasks', () => {
    class Handler1 {
      async task1(): Promise<void> {}
    }

    class Handler2 {
      async task2(): Promise<void> {}
    }

    const metadata1: TaskMetadata = { name: 'task-1', target: Handler1, methodName: 'task1' };
    const metadata2: TaskMetadata = { name: 'task-2', target: Handler2, methodName: 'task2' };

    TaskRegistry.getInstance().register('task-1', Handler1, 'task1', metadata1);
    TaskRegistry.getInstance().register('task-2', Handler2, 'task2', metadata2);

    const allTasks = TaskRegistry.getInstance().getAll();

    expect(allTasks).toHaveLength(2);
    expect(allTasks.map((t) => t.name)).toContain('task-1');
    expect(allTasks.map((t) => t.name)).toContain('task-2');
  });

  it('should check if task exists', () => {
    class Handler {
      async work(): Promise<void> {}
    }

    TaskRegistry.getInstance().register('work-task', Handler, 'work', {
      name: 'work-task',
      target: Handler,
      methodName: 'work',
    });

    expect(TaskRegistry.getInstance().has('work-task')).toBe(true);
    expect(TaskRegistry.getInstance().has('non-existent')).toBe(false);
  });

  it('should collect tasks from MetadataStorage', () => {
    class TaskHandler {
      @Task({ name: 'decorated-task' })
      async handle(): Promise<void> {}
    }

    const registry = TaskRegistry.getInstance();
    registry.collectFromMetadata();

    expect(registry.has('decorated-task')).toBe(true);

    const task = registry.get('decorated-task');
    expect(task?.name).toBe('decorated-task');
  });

  it('should not duplicate existing tasks when collecting from metadata', () => {
    class TaskHandler {
      @Task({ name: 'existing-task' })
      async handle(): Promise<void> {}
    }

    const registry = TaskRegistry.getInstance();

    // First collection
    registry.collectFromMetadata();
    // Second collection should not duplicate
    registry.collectFromMetadata();

    const allTasks = registry.getAll();
    const existingTasks = allTasks.filter((t) => t.name === 'existing-task');

    expect(existingTasks).toHaveLength(1);
  });

  it('should reset all tasks', () => {
    class Handler {
      async task(): Promise<void> {}
    }

    TaskRegistry.getInstance().register('task', Handler, 'task', {
      name: 'task',
      target: Handler,
      methodName: 'task',
    });

    expect(TaskRegistry.getInstance().has('task')).toBe(true);

    TaskRegistry.getInstance().reset();

    expect(TaskRegistry.getInstance().has('task')).toBe(false);
    expect(TaskRegistry.getInstance().getAll()).toHaveLength(0);
  });
});

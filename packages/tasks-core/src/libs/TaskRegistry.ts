import { MetadataStorage } from '@croco/framework-context';
import { TASK_METADATA_KEY } from './decorators/Task';
import { DuplicateTaskRegistrationProblem } from './problems/TasksProblems';
import type { TaskMetadata } from './types';

export type RegisteredTask = {
  name: string;
  target: object;
  methodName: string;
  metadata: TaskMetadata;
};

export class TaskRegistry {
  private static instance: TaskRegistry;
  private tasks: Map<string, RegisteredTask>;

  constructor(tasks?: Iterable<RegisteredTask>) {
    this.tasks = new Map(Array.from(tasks ?? [], (task) => [task.name, task]));
  }

  static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  static fromMetadata(metadata: TaskMetadata[] = TaskRegistry.getMetadataTasks()): TaskRegistry {
    const registry = new TaskRegistry();
    registry.collect(metadata);
    return registry;
  }

  register(name: string, target: object, methodName: string, metadata: TaskMetadata): void {
    const existingTask = this.get(name);

    if (existingTask) {
      if (TaskRegistry.isSameRegistration(existingTask, target, methodName, metadata)) {
        return;
      }

      throw new DuplicateTaskRegistrationProblem(name);
    }

    this.tasks.set(name, { name, target, methodName, metadata });
  }

  get(name: string): RegisteredTask | undefined {
    return this.tasks.get(name);
  }

  getAll(): RegisteredTask[] {
    return Array.from(this.tasks.values());
  }

  has(name: string): boolean {
    return this.tasks.has(name);
  }

  collectFromMetadata(metadata: TaskMetadata[] = TaskRegistry.getMetadataTasks()): void {
    this.collect(metadata);
  }

  private collect(metadataEntries: TaskMetadata[]): void {
    for (const metadata of metadataEntries) {
      this.register(metadata.name, metadata.target, String(metadata.methodName), metadata);
    }
  }

  private static getMetadataTasks(): TaskMetadata[] {
    return MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY).map((entry) => entry.value);
  }

  private static isSameRegistration(
    existingTask: RegisteredTask,
    target: object,
    methodName: string,
    metadata: TaskMetadata
  ): boolean {
    return (
      existingTask.target === target &&
      existingTask.methodName === methodName &&
      existingTask.metadata.target === metadata.target &&
      String(existingTask.metadata.methodName) === String(metadata.methodName) &&
      TaskRegistry.isSameOptions(existingTask.metadata.options, metadata.options)
    );
  }

  private static isSameOptions(
    existingOptions?: TaskMetadata['options'],
    nextOptions?: TaskMetadata['options']
  ): boolean {
    return (
      existingOptions?.maxAttempts === nextOptions?.maxAttempts &&
      existingOptions?.timeout === nextOptions?.timeout &&
      existingOptions?.idempotencyKey === nextOptions?.idempotencyKey &&
      existingOptions?.name === nextOptions?.name
    );
  }

  reset(): void {
    this.tasks.clear();
  }
}

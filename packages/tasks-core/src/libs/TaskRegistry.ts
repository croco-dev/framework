import { MetadataStorage } from '@croco/framework-context';
import { TASK_METADATA_KEY } from './decorators/Task';
import type { TaskMetadata } from './types';

export type RegisteredTask = {
  name: string;
  target: object;
  methodName: string;
  metadata: TaskMetadata;
};

export class TaskRegistry {
  private static instance: TaskRegistry;
  private tasks = new Map<string, RegisteredTask>();

  private constructor() {}

  static getInstance(): TaskRegistry {
    if (!TaskRegistry.instance) {
      TaskRegistry.instance = new TaskRegistry();
    }
    return TaskRegistry.instance;
  }

  register(name: string, target: object, methodName: string, metadata: TaskMetadata): void {
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

  collectFromMetadata(): void {
    const allMetadata = MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY);
    for (const { value: metadata } of allMetadata) {
      if (!this.has(metadata.name)) {
        this.register(metadata.name, metadata.target, metadata.methodName, metadata);
      }
    }
  }

  reset(): void {
    this.tasks.clear();
  }
}

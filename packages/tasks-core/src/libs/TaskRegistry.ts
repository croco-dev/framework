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
      if (!this.has(metadata.name)) {
        this.register(metadata.name, metadata.target, String(metadata.methodName), metadata);
      }
    }
  }

  private static getMetadataTasks(): TaskMetadata[] {
    return MetadataStorage.getAll<TaskMetadata>(TASK_METADATA_KEY).map((entry) => entry.value);
  }

  reset(): void {
    this.tasks.clear();
  }
}

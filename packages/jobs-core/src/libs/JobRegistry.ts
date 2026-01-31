import { MetadataStorage } from '@croco/framework-context';
import type { JobHandler } from './decorators/Job';
import { JOB_METADATA_KEY, type JobMetadata } from './decorators/Job';

export type RegisteredJob = {
  name: string;
  handler: JobHandler;
  metadata: JobMetadata;
};

export class JobRegistry {
  private static instance: JobRegistry;
  private handlers = new Map<string, RegisteredJob>();

  private constructor() {}

  static getInstance(): JobRegistry {
    if (!JobRegistry.instance) {
      JobRegistry.instance = new JobRegistry();
    }
    return JobRegistry.instance;
  }

  register(name: string, handler: JobHandler, metadata: JobMetadata): void {
    this.handlers.set(name, { name, handler, metadata });
  }

  get(name: string): RegisteredJob | undefined {
    return this.handlers.get(name);
  }

  getAll(): RegisteredJob[] {
    return Array.from(this.handlers.values());
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  collectFromMetadata(): void {
    const allMetadata = MetadataStorage.getAll<JobMetadata>(JOB_METADATA_KEY);
    for (const { value: metadata } of allMetadata) {
      if (!this.has(metadata.name)) {
        const instance = new (metadata.target as new () => JobHandler)();
        this.register(metadata.name, instance, metadata);
      }
    }
  }

  reset(): void {
    this.handlers.clear();
  }
}

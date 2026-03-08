import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { SQSEvent } from 'aws-lambda';
import { Container, type ContainerInstance } from 'typedi';
import { BootstrapError, ContainerInitializationError } from './errors';
import type { WorkerConfig } from './types';

/**
 * SQS-based worker bootstrap utility (provider-agnostic)
 */
class WorkerRuntime<TD = unknown, TR = unknown> {
  private config: WorkerConfig<TD, TR> | null = null;
  private isInitialized = false;
  private containerId = randomUUID();
  private container: ContainerInstance = Container.of(this.containerId);

  private ensureReflectMetadata() {
    if (!Reflect || !Reflect.defineMetadata) {
      throw new BootstrapError('reflect-metadata is not loaded. Please import it before using Worker.');
    }
  }

  private async initializeContainer(config: WorkerConfig<TD, TR>) {
    try {
      this.container.reset({ strategy: 'resetValue' });
      if (config.containerSetup) {
        for (const setup of config.containerSetup) {
          await setup(this.container);
        }
      }
    } catch (error) {
      throw new ContainerInitializationError('Failed to initialize TypeDI container for worker', error);
    }
  }

  async bootstrap(config: WorkerConfig<TD, TR>): Promise<void> {
    if (this.isInitialized) {
      throw new BootstrapError('Worker has already been initialized');
    }

    if (!config.getJob) {
      throw new BootstrapError('WorkerConfig.getJob is required to resolve job handlers');
    }

    try {
      this.ensureReflectMetadata();
      this.config = config;
      await this.initializeContainer(config);
      if (config.onWorkerBootstrap) {
        await config.onWorkerBootstrap(this.container);
      }
      this.isInitialized = true;
    } catch (error) {
      throw new BootstrapError('Failed to bootstrap worker', error);
    }
  }

  async processEvent(event: SQSEvent): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
    if (!this.isInitialized || !this.config) {
      throw new BootstrapError('Worker not initialized. Call bootstrap() first.');
    }

    const config = this.config;

    const results = await Promise.allSettled(
      event.Records.map(async (record) => {
        let parsedJob: { job: string; data: TD } | null = null;

        try {
          parsedJob = JSON.parse(record.body) as { job: string; data: TD };
          const { job, data } = parsedJob;

          if (config.beforeJobExecution) {
            await config.beforeJobExecution(job, data);
          }

          const JobRunner = config.getJob(job);
          const jobInstance = this.container.get(JobRunner);
          const result = (await jobInstance.execute(data)) as TR;

          if (config.afterJobExecution) {
            await config.afterJobExecution(job, data, result);
          }
        } catch (error) {
          console.error(`Error processing job:`, error);

          if (config.onJobError && parsedJob) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));

            try {
              await config.onJobError(parsedJob.job, parsedJob.data, normalizedError);
            } catch (onJobErrorFailure) {
              console.error('onJobError hook failed:', onJobErrorFailure);
            }
          }

          throw error;
        }
      })
    );

    const batchItemFailures = results
      .map((result, index) => {
        if (result.status === 'rejected') {
          return { itemIdentifier: event.Records[index].messageId };
        }
        return null;
      })
      .filter((item): item is { itemIdentifier: string } => item !== null);

    return { batchItemFailures };
  }

  reset() {
    this.config = null;
    this.isInitialized = false;
    Container.reset(this.containerId);
    this.containerId = randomUUID();
    this.container = Container.of(this.containerId);
  }
}

export class Worker<TD = unknown, TR = unknown> {
  private static defaultProcessEvent:
    | ((event: SQSEvent) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }>)
    | null = null;
  private static defaultReset: (() => void) | null = null;
  private readonly runtime = new WorkerRuntime<TD, TR>();

  async bootstrap(config: WorkerConfig<TD, TR>): Promise<void> {
    await this.runtime.bootstrap(config);
  }

  async processEvent(event: SQSEvent): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
    return this.runtime.processEvent(event);
  }

  reset(): void {
    this.runtime.reset();
  }

  static async bootstrap<TD = unknown, TR = unknown>(config: WorkerConfig<TD, TR>): Promise<void> {
    const worker = new Worker<TD, TR>();
    await worker.bootstrap(config);
    Worker.defaultProcessEvent = (event: SQSEvent) => worker.processEvent(event);
    Worker.defaultReset = () => worker.reset();
  }

  static async processEvent(event: SQSEvent): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
    if (!Worker.defaultProcessEvent) {
      throw new BootstrapError('Worker not initialized. Call bootstrap() first.');
    }

    return Worker.defaultProcessEvent(event);
  }

  static reset() {
    Worker.defaultReset?.();
    Worker.defaultProcessEvent = null;
    Worker.defaultReset = null;
  }
}

export async function createWorker<TD = unknown, TR = unknown>(config: WorkerConfig<TD, TR>) {
  const worker = new Worker<TD, TR>();
  await worker.bootstrap(config);

  return async (event: SQSEvent) => {
    return worker.processEvent(event);
  };
}

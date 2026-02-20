import 'reflect-metadata';
import type { SQSEvent } from 'aws-lambda';
import { Container } from 'typedi';
import { BootstrapError, ContainerInitializationError } from './errors';
import type { WorkerConfig } from './types';

/**
 * SQS-based worker bootstrap utility (provider-agnostic)
 */
export class Worker {
  private static config: WorkerConfig | null = null;
  private static isInitialized = false;

  private static ensureReflectMetadata() {
    if (!Reflect || !Reflect.defineMetadata) {
      throw new BootstrapError('reflect-metadata is not loaded. Please import it before using Worker.');
    }
  }

  private static async initializeContainer<TD = unknown, TR = unknown>(config: WorkerConfig<TD, TR>) {
    try {
      Container.reset();
      if (config.containerSetup) {
        for (const setup of config.containerSetup) {
          await setup();
        }
      }
    } catch (error) {
      throw new ContainerInitializationError('Failed to initialize TypeDI container for worker', error);
    }
  }

  static async bootstrap<TD = unknown, TR = unknown>(config: WorkerConfig<TD, TR>): Promise<void> {
    if (Worker.isInitialized) {
      throw new BootstrapError('Worker has already been initialized');
    }

    if (!config.getJob) {
      throw new BootstrapError('WorkerConfig.getJob is required to resolve job handlers');
    }

    try {
      Worker.ensureReflectMetadata();
      Worker.config = config as unknown as WorkerConfig;
      await Worker.initializeContainer(config);
      if (config.onWorkerBootstrap) {
        await config.onWorkerBootstrap(Container);
      }
      Worker.isInitialized = true;
    } catch (error) {
      throw new BootstrapError('Failed to bootstrap worker', error);
    }
  }

  static async processEvent<TD = unknown, TR = unknown>(
    event: SQSEvent
  ): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
    if (!Worker.isInitialized) {
      throw new BootstrapError('Worker not initialized. Call bootstrap() first.');
    }

    const config = Worker.config as unknown as WorkerConfig<TD, TR>;

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
          const jobInstance = Container.get(JobRunner);
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

  static reset() {
    Worker.config = null;
    Worker.isInitialized = false;
    Container.reset();
  }
}

export async function createWorker<TD = unknown, TR = unknown>(config: WorkerConfig<TD, TR>) {
  await Worker.bootstrap<TD, TR>(config);
  return async (event: SQSEvent) => {
    return Worker.processEvent<TD, TR>(event);
  };
}

import 'reflect-metadata';

import type { SQSEvent } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { createWorker, Worker } from './worker';

type JobPayload = {
  value: string;
};

const createEvent = (job: string, data: JobPayload): SQSEvent => ({
  Records: [
    {
      messageId: `${job}-${data.value}`,
      receiptHandle: 'receipt',
      body: JSON.stringify({ job, data }),
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '0',
        SenderId: 'sender',
        ApproximateFirstReceiveTimestamp: '0',
      },
      messageAttributes: {},
      md5OfBody: 'md5',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:ap-northeast-2:123456789012:queue',
      awsRegion: 'ap-northeast-2',
    },
  ],
});

describe('Worker', () => {
  it('should allow multiple created workers to stay isolated', async () => {
    const alphaSink: string[] = [];
    const betaSink: string[] = [];

    class AlphaJob {
      async execute(data: JobPayload): Promise<void> {
        alphaSink.push(`alpha:${data.value}`);
      }
    }

    class BetaJob {
      async execute(data: JobPayload): Promise<void> {
        betaSink.push(`beta:${data.value}`);
      }
    }

    const alphaWorker = await createWorker<JobPayload, void>({
      containerSetup: [(container) => void container.set(AlphaJob, new AlphaJob())],
      getJob: () => AlphaJob,
    });

    const betaWorker = await createWorker<JobPayload, void>({
      containerSetup: [(container) => void container.set(BetaJob, new BetaJob())],
      getJob: () => BetaJob,
    });

    await expect(alphaWorker(createEvent('alpha', { value: 'one' }))).resolves.toEqual({ batchItemFailures: [] });
    await expect(betaWorker(createEvent('beta', { value: 'two' }))).resolves.toEqual({ batchItemFailures: [] });

    expect(alphaSink).toEqual(['alpha:one']);
    expect(betaSink).toEqual(['beta:two']);
  });

  it('should reset one worker instance without breaking another', async () => {
    const alphaSink: string[] = [];
    const betaSink: string[] = [];

    class AlphaJob {
      async execute(data: JobPayload): Promise<void> {
        alphaSink.push(`alpha:${data.value}`);
      }
    }

    class BetaJob {
      async execute(data: JobPayload): Promise<void> {
        betaSink.push(`beta:${data.value}`);
      }
    }

    const alphaWorker = new Worker<JobPayload, void>();
    await alphaWorker.bootstrap({
      containerSetup: [(container) => void container.set(AlphaJob, new AlphaJob())],
      getJob: () => AlphaJob,
    });

    const betaWorker = new Worker<JobPayload, void>();
    await betaWorker.bootstrap({
      containerSetup: [(container) => void container.set(BetaJob, new BetaJob())],
      getJob: () => BetaJob,
    });

    alphaWorker.reset();

    await expect(betaWorker.processEvent(createEvent('beta', { value: 'two' }))).resolves.toEqual({
      batchItemFailures: [],
    });

    expect(alphaSink).toEqual([]);
    expect(betaSink).toEqual(['beta:two']);
  });
});

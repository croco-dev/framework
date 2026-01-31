import type {
  JobDispatchOptions,
  JobReference,
  JobStatus,
  JobStore,
  ScheduleOptions,
  ScheduleReference,
} from '@croco/jobs-core';
import { JobState, parseDuration } from '@croco/jobs-core';
import { Client } from '@upstash/qstash';

export type QStashJobStoreOptions = {
  token: string;
  baseUrl: string; // Job webhook을 받을 base URL
  retries?: number;
  retryDelay?: string; // "pow(2,retried)*1000" 형식
};

export class QStashJobStore implements JobStore {
  private readonly client: Client;
  private readonly baseUrl: string;
  private readonly defaultRetries: number;

  constructor(options: QStashJobStoreOptions) {
    this.client = new Client({ token: options.token });
    this.baseUrl = options.baseUrl;
    this.defaultRetries = options.retries ?? 3;
    this.defaultRetryDelay = options.retryDelay ?? '1000';
  }

  async dispatch<T>(jobName: string, payload: T, options?: JobDispatchOptions): Promise<JobReference> {
    const url = `${this.baseUrl}/jobs/${jobName}`;

    let delay: number | undefined;
    if (options?.delay) {
      if (typeof options.delay === 'number') {
        delay = Math.floor(options.delay / 1000);
      } else {
        delay = Math.floor(parseDuration(options.delay) / 1000);
      }
    }

    const response = await this.client.publishJSON({
      url,
      body: { jobName, payload, metadata: options?.metadata },
      delay,
      notBefore: options?.notBefore ? Math.floor(new Date(options.notBefore).getTime() / 1000) : undefined,
      retries: this.defaultRetries,
    });

    return {
      jobId: response.messageId,
      jobName,
    };
  }

  async getStatus(jobId: string): Promise<JobStatus> {
    try {
      const messages = await this.client.messages.get(jobId);
      const message = messages as unknown as {
        state: string;
        createdAt: number;
        retried?: number;
      };
      return {
        jobId,
        state: this.mapQStashState(message.state),
        createdAt: message.createdAt,
        attempts: message.retried ?? 0,
      };
    } catch {
      return {
        jobId,
        state: JobState.PENDING,
        createdAt: Date.now(),
        attempts: 0,
      };
    }
  }

  async cancel(jobId: string): Promise<boolean> {
    try {
      await this.client.messages.delete(jobId);
      return true;
    } catch {
      return false;
    }
  }

  async schedule(jobName: string, cron: string, options?: ScheduleOptions): Promise<ScheduleReference> {
    const url = `${this.baseUrl}/jobs/${jobName}`;

    const response = await this.client.schedules.create({
      destination: url,
      cron,
      body: JSON.stringify({ jobName, payload: options?.payload }),
      retries: this.defaultRetries,
    });

    return {
      scheduleId: response.scheduleId,
      jobName,
      cron,
    };
  }

  async unschedule(scheduleId: string): Promise<boolean> {
    try {
      await this.client.schedules.delete(scheduleId);
      return true;
    } catch {
      return false;
    }
  }

  private mapQStashState(state: string): JobState {
    switch (state) {
      case 'CREATED':
      case 'ACTIVE':
        return JobState.PENDING;
      case 'DELIVERED':
        return JobState.COMPLETED;
      case 'ERROR':
      case 'FAILED':
        return JobState.FAILED;
      case 'RETRY':
        return JobState.RUNNING;
      default:
        return JobState.PENDING;
    }
  }
}

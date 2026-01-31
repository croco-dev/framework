import type { JobStore } from './JobStore';
import type {
  JobDispatchOptions,
  JobReference,
  JobState,
  JobStatus,
  ScheduleOptions,
  ScheduleReference,
} from './types';

type InternalJob = {
  jobId: string;
  jobName: string;
  payload: unknown;
  state: JobState;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  attempts: number;
};

type InternalSchedule = {
  scheduleId: string;
  jobName: string;
  cron: string;
  options?: ScheduleOptions;
  createdAt: number;
};

/**
 * In-memory job store for testing and development.
 * NOT suitable for production multi-instance deployments.
 */
export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, InternalJob>();
  private readonly schedules = new Map<string, InternalSchedule>();

  async dispatch<T>(jobName: string, payload: T, _options?: JobDispatchOptions): Promise<JobReference> {
    const jobId = crypto.randomUUID();
    const job: InternalJob = {
      jobId,
      jobName,
      payload,
      state: 'PENDING' as JobState,
      createdAt: Date.now(),
      attempts: 0,
    };
    this.jobs.set(jobId, job);
    return { jobId, jobName };
  }

  async getStatus(jobId: string): Promise<JobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    return {
      jobId: job.jobId,
      state: job.state,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      attempts: job.attempts,
    };
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }
    job.state = 'CANCELLED' as JobState;
    job.completedAt = Date.now();
    return true;
  }

  async schedule(jobName: string, cron: string, options?: ScheduleOptions): Promise<ScheduleReference> {
    const scheduleId = crypto.randomUUID();
    const schedule: InternalSchedule = {
      scheduleId,
      jobName,
      cron,
      options,
      createdAt: Date.now(),
    };
    this.schedules.set(scheduleId, schedule);
    return { scheduleId, jobName, cron };
  }

  async unschedule(scheduleId: string): Promise<boolean> {
    return this.schedules.delete(scheduleId);
  }

  /**
   * Clear all jobs and schedules (for testing)
   */
  reset(): void {
    this.jobs.clear();
    this.schedules.clear();
  }
}

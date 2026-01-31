import type { RetryPolicyOptions } from '@croco/retry-core';

/**
 * Duration type: either milliseconds (number) or duration string (e.g., '10s', '5m')
 */
export type Duration = string | number;

/**
 * Job execution options
 */
export type JobOptions = {
  /** Retry policy configuration */
  retryPolicy?: RetryPolicyOptions;
  /** Backoff policy for retries */
  backoffPolicy?: {
    /** Initial delay in milliseconds */
    initialDelay?: number;
    /** Multiplier for exponential backoff */
    multiplier?: number;
    /** Maximum delay in milliseconds */
    maxDelay?: number;
  };
  /** Job timeout in milliseconds */
  timeout?: number;
};

/**
 * Job dispatch options
 */
export type JobDispatchOptions = {
  /** Delay before execution (duration string or milliseconds) */
  delay?: Duration;
  /** Earliest execution time (ISO 8601 date string) */
  notBefore?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Job state enumeration
 */
export enum JobState {
  /** Job is queued and waiting to be processed */
  PENDING = 'PENDING',
  /** Job is currently being processed */
  RUNNING = 'RUNNING',
  /** Job completed successfully */
  COMPLETED = 'COMPLETED',
  /** Job failed after all retries */
  FAILED = 'FAILED',
  /** Job was cancelled before completion */
  CANCELLED = 'CANCELLED',
}

/**
 * Job execution status
 */
export type JobStatus = {
  /** Unique job identifier */
  jobId: string;
  /** Current job state */
  state: JobState;
  /** Job creation timestamp (Unix epoch ms) */
  createdAt: number;
  /** Job start timestamp (Unix epoch ms) */
  startedAt?: number;
  /** Job completion timestamp (Unix epoch ms) */
  completedAt?: number;
  /** Error message if job failed */
  error?: string;
  /** Number of execution attempts */
  attempts: number;
};

/**
 * Reference to a dispatched job
 */
export type JobReference = {
  /** Unique job identifier */
  jobId: string;
  /** Job name/identifier */
  jobName: string;
};

/**
 * Schedule options
 */
export type ScheduleOptions = {
  /** Human-readable schedule name */
  name?: string;
  /** Time zone for schedule (IANA tz database format) */
  timeZone?: string;
  /** Whether the schedule is disabled */
  disabled?: boolean;
  /** Default payload for scheduled jobs */
  payload?: unknown;
};

/**
 * Reference to a schedule
 */
export type ScheduleReference = {
  /** Unique schedule identifier */
  scheduleId: string;
  /** Associated job name */
  jobName: string;
  /** Cron expression */
  cron: string;
};

/**
 * Parse duration string to milliseconds
 * @example '10s' -> 10000, '5m' -> 300000, '2h' -> 7200000
 * @throws {Error} if duration format is invalid
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}. Use format like '10s', '5m', '2h', '1d'`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * multipliers[unit];
}

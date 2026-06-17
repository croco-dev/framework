import { JobNotFoundProblem } from "./problems";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying"
  | "timed_out";

export type JobLogEntry = {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
};

export type JobFailurePolicy = {
  state: string;
  needsAttention: boolean;
  retryable: boolean;
  replayable: boolean;
  recoveryAction: string;
  reason: string;
};

export type JobSummary = {
  id: string;
  type: string;
  status: JobStatus;
  workflowName?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  replayOf?: string;
  errorMessage?: string;
  logCount: number;
  failurePolicy: JobFailurePolicy;
};

export type JobDetails = JobSummary & {
  payload?: unknown;
  result?: unknown;
  error?: { message: string; code?: string; retryable: boolean };
  metadata?: Record<string, unknown>;
  checkpoints?: Record<string, unknown>;
  progress?: unknown;
  logs: readonly JobLogEntry[];
};

export type JobListOptions = {
  status?: JobStatus;
  type?: string;
  limit?: number;
  offset?: number;
};

export type JobListReport = {
  summary: "healthy" | "attention";
  generatedAt: string;
  total: number;
  attentionCount: number;
  jobs: readonly JobSummary[];
};

export type JobActionOptions = {
  reason?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function getFailurePolicy(job: {
  status: JobStatus;
  error?: { message: string; retryable: boolean };
}): JobFailurePolicy {
  if (job.status === "completed") {
    return {
      state: "succeeded",
      needsAttention: false,
      retryable: false,
      replayable: false,
      recoveryAction: "No action needed.",
      reason: "The job completed successfully.",
    };
  }

  if (job.status === "cancelled") {
    return {
      state: "cancelled",
      needsAttention: false,
      retryable: false,
      replayable: true,
      recoveryAction: "Replay the job if the cancellation was accidental.",
      reason: "The job was cancelled before completion.",
    };
  }

  if (job.status === "running" || job.status === "pending") {
    return {
      state: job.status,
      needsAttention: false,
      retryable: false,
      replayable: false,
      recoveryAction: "Wait for the job to finish or cancel it if it is stuck.",
      reason: `The job is currently ${job.status}.`,
    };
  }

  if (job.status === "retrying") {
    return {
      state: "retrying",
      needsAttention: true,
      retryable: true,
      replayable: false,
      recoveryAction: "Inspect the latest logs before the next retry attempt.",
      reason: "The job failed with a retryable error and has attempts remaining.",
    };
  }

  if (job.status === "timed_out") {
    return {
      state: "timed_out",
      needsAttention: true,
      retryable: true,
      replayable: true,
      recoveryAction: "Increase the timeout or fix the stalled work, then replay.",
      reason: "The job exceeded its timeout.",
    };
  }

  return {
    state: job.error?.retryable ? "retry_exhausted" : "dead_lettered",
    needsAttention: true,
    retryable: Boolean(job.error?.retryable),
    replayable: true,
    recoveryAction: "Inspect the error and replay after the cause is fixed.",
    reason: job.error?.message ?? "The job failed.",
  };
}

function summarizeJob(job: JobDetails): JobSummary {
  const failurePolicy = getFailurePolicy(job);
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    workflowName: job.workflowName,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    replayOf: job.replayOf,
    errorMessage: job.error?.message,
    logCount: job.logs.length,
    failurePolicy,
  };
}

export class InMemoryJobsOperations {
  private readonly jobs = new Map<string, JobDetails>();
  private replayCounter = 0;

  create(params: {
    id: string;
    type: string;
    payload?: unknown;
    maxAttempts?: number;
    metadata?: Record<string, unknown>;
  }): JobDetails {
    const existing = this.jobs.get(params.id);
    if (existing) return existing;

    const job: JobDetails = {
      id: params.id,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: nowIso(),
      payload: params.payload,
      metadata: params.metadata,
      workflowName:
        typeof params.metadata?.workflowName === "string"
          ? params.metadata.workflowName
          : undefined,
      logCount: 0,
      failurePolicy: getFailurePolicy({ status: "pending" }),
      logs: [],
    };

    this.jobs.set(job.id, job);
    return job;
  }

  start(id: string): JobDetails {
    const job = this.requireJob(id);
    return this.save({
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      startedAt: job.startedAt ?? nowIso(),
    });
  }

  recordLog(
    id: string,
    params: { message: string; data?: Record<string, unknown>; level?: JobLogEntry["level"] },
  ): JobDetails {
    const job = this.requireJob(id);
    return this.save({
      ...job,
      logs: [
        ...job.logs,
        {
          timestamp: nowIso(),
          level: params.level ?? "info",
          message: params.message,
          data: params.data,
        },
      ],
    });
  }

  complete(id: string, result?: unknown): JobDetails {
    const job = this.requireJob(id);
    return this.save({
      ...job,
      status: "completed",
      completedAt: nowIso(),
      result,
    });
  }

  fail(id: string, error: { message: string; code?: string; retryable?: boolean }): JobDetails {
    const job = this.requireJob(id);
    return this.save({
      ...job,
      status: "failed",
      completedAt: nowIso(),
      error: {
        message: error.message,
        code: error.code,
        retryable: Boolean(error.retryable),
      },
    });
  }

  list(options: JobListOptions = {}): JobListReport {
    let jobs = [...this.jobs.values()].map((job) => summarizeJob(job));

    if (options.status) {
      jobs = jobs.filter((job) => job.status === options.status);
    }
    if (options.type) {
      jobs = jobs.filter((job) => job.type === options.type);
    }

    const total = jobs.length;
    const attentionCount = jobs.filter((job) => job.failurePolicy.needsAttention).length;
    const offset = options.offset ?? 0;
    const pagedJobs = jobs.slice(offset, options.limit ? offset + options.limit : undefined);

    return {
      summary: attentionCount > 0 ? "attention" : "healthy",
      generatedAt: nowIso(),
      total,
      attentionCount,
      jobs: pagedJobs,
    };
  }

  show(id: string): JobDetails {
    return this.withSummaryFields(this.requireJob(id));
  }

  logs(id: string): readonly JobLogEntry[] {
    return this.requireJob(id).logs;
  }

  cancel(id: string, _options: JobActionOptions = {}): JobDetails {
    const job = this.requireJob(id);
    return this.save({
      ...job,
      status: "cancelled",
      completedAt: nowIso(),
    });
  }

  replay(id: string, options: JobActionOptions = {}): JobDetails {
    const job = this.requireJob(id);
    const replay = this.create({
      id: `${job.id}:replay-${++this.replayCounter}`,
      type: job.type,
      payload: job.payload,
      maxAttempts: job.maxAttempts,
      metadata: {
        ...job.metadata,
        replayReason: options.reason,
      },
    });

    return this.save({
      ...replay,
      replayOf: job.id,
      logs: [
        {
          timestamp: nowIso(),
          level: "info",
          message: "Job replay requested",
          data: options.reason ? { reason: options.reason } : undefined,
        },
      ],
    });
  }

  private requireJob(id: string): JobDetails {
    const job = this.jobs.get(id);
    if (!job) {
      throw new JobNotFoundProblem(id);
    }
    return job;
  }

  private save(job: JobDetails): JobDetails {
    const updated = this.withSummaryFields(job);
    this.jobs.set(job.id, updated);
    return updated;
  }

  private withSummaryFields(job: JobDetails): JobDetails {
    const summary = summarizeJob(job);
    return {
      ...job,
      ...summary,
      logs: job.logs,
    };
  }
}

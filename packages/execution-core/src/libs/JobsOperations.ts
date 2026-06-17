import { ExecutionProblems } from "./ExecutionProblem";
import type {
  ExecutionInspectionManager,
  ExecutionManager,
  ExecutionReplayManager,
} from "./interfaces/ExecutionManager";
import type {
  Execution,
  ExecutionError,
  ExecutionLogEntry,
  ExecutionStatus,
  ListExecutionsOptions,
  ProgressInfo,
  ReplayExecutionParams,
} from "./types";

export type JobFailurePolicyState =
  | "pending"
  | "running"
  | "succeeded"
  | "cancelled"
  | "retrying"
  | "retry_exhausted"
  | "timed_out"
  | "dead_lettered";

export type JobRecoveryAction = "none" | "wait" | "retry" | "replay" | "inspect";

export type JobFailurePolicy = {
  readonly state: JobFailurePolicyState;
  readonly needsAttention: boolean;
  readonly retryable: boolean;
  readonly replayable: boolean;
  readonly recoveryAction: JobRecoveryAction;
  readonly reason: string;
};

export type JobSummary = {
  readonly id: string;
  readonly type: string;
  readonly status: ExecutionStatus;
  readonly workflowName?: string;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly replayOf?: string;
  readonly errorMessage?: string;
  readonly logCount: number;
  readonly failurePolicy: JobFailurePolicy;
};

export type JobDetails = JobSummary & {
  readonly payload?: unknown;
  readonly result?: unknown;
  readonly error?: ExecutionError;
  readonly metadata?: Record<string, unknown>;
  readonly checkpoints?: Record<string, unknown>;
  readonly progress?: ProgressInfo;
  readonly logs: readonly ExecutionLogEntry[];
};

export type JobListReport = {
  readonly summary: "healthy" | "attention";
  readonly generatedAt: string;
  readonly total: number;
  readonly attentionCount: number;
  readonly jobs: readonly JobSummary[];
};

export type JobListOptions = ListExecutionsOptions;

export type CancelJobParams = {
  readonly reason?: string;
};

export interface JobsOperations {
  list(options?: JobListOptions): Promise<JobListReport>;
  show(id: string): Promise<JobDetails>;
  logs(id: string): Promise<readonly ExecutionLogEntry[]>;
  cancel(id: string, params?: CancelJobParams): Promise<JobDetails>;
  replay(id: string, params?: ReplayExecutionParams): Promise<JobDetails>;
}

export type ExecutionJobsManager = ExecutionManager &
  Partial<ExecutionInspectionManager> &
  Partial<ExecutionReplayManager>;

type InspectableExecutionJobsManager = ExecutionManager &
  Pick<ExecutionInspectionManager, "get" | "list"> &
  Partial<ExecutionReplayManager>;

type ReplayableExecutionJobsManager = InspectableExecutionJobsManager &
  Pick<ExecutionReplayManager, "replay">;

function isInspectable(manager: ExecutionJobsManager): manager is InspectableExecutionJobsManager {
  return typeof manager.get === "function" && typeof manager.list === "function";
}

function isReplayable(manager: ExecutionJobsManager): manager is ReplayableExecutionJobsManager {
  return isInspectable(manager) && typeof manager.replay === "function";
}

function requireInspection(manager: ExecutionJobsManager): InspectableExecutionJobsManager {
  if (!isInspectable(manager)) {
    throw ExecutionProblems.conflict("Execution manager does not support job inspection");
  }

  return manager;
}

function requireReplay(manager: ExecutionJobsManager): ReplayableExecutionJobsManager {
  if (!isReplayable(manager)) {
    throw ExecutionProblems.conflict("Execution manager does not support job replay");
  }

  return manager;
}

function toIsoTimestamp(timestamp?: Date): string | undefined {
  return timestamp?.toISOString();
}

function readWorkflowName(execution: Execution): string | undefined {
  const workflowName = execution.metadata?.workflowName;
  return typeof workflowName === "string" ? workflowName : undefined;
}

function hasAttemptsRemaining(execution: Execution): boolean {
  return execution.attempts < execution.maxAttempts;
}

export function getJobFailurePolicy(execution: Execution): JobFailurePolicy {
  switch (execution.status) {
    case "pending":
      return {
        state: "pending",
        needsAttention: false,
        retryable: false,
        replayable: false,
        recoveryAction: "wait",
        reason: "Job is waiting to start",
      };
    case "running":
      return {
        state: "running",
        needsAttention: false,
        retryable: false,
        replayable: false,
        recoveryAction: "wait",
        reason: "Job is currently running",
      };
    case "completed":
      return {
        state: "succeeded",
        needsAttention: false,
        retryable: false,
        replayable: false,
        recoveryAction: "none",
        reason: "Job completed successfully",
      };
    case "cancelled":
      return {
        state: "cancelled",
        needsAttention: false,
        retryable: false,
        replayable: false,
        recoveryAction: "none",
        reason: "Job was cancelled",
      };
    case "retrying":
      return {
        state: "retrying",
        needsAttention: true,
        retryable: true,
        replayable: false,
        recoveryAction: "wait",
        reason: "Job failed a retryable attempt and is waiting for another run",
      };
    case "timed_out":
      return {
        state: "timed_out",
        needsAttention: true,
        retryable: hasAttemptsRemaining(execution),
        replayable: true,
        recoveryAction: hasAttemptsRemaining(execution) ? "retry" : "replay",
        reason: "Job timed out before completion",
      };
    case "failed":
      if (execution.error?.retryable && !hasAttemptsRemaining(execution)) {
        return {
          state: "retry_exhausted",
          needsAttention: true,
          retryable: false,
          replayable: true,
          recoveryAction: "replay",
          reason: "Job exhausted retry attempts",
        };
      }

      return {
        state: "dead_lettered",
        needsAttention: true,
        retryable: false,
        replayable: true,
        recoveryAction: "replay",
        reason: execution.error?.retryable
          ? "Job failed and requires operator replay"
          : "Job failed with a non-retryable error",
      };
  }
}

export function summarizeJob(execution: Execution): JobSummary {
  return {
    id: execution.id,
    type: execution.type,
    status: execution.status,
    workflowName: readWorkflowName(execution),
    attempts: execution.attempts,
    maxAttempts: execution.maxAttempts,
    createdAt: execution.createdAt.toISOString(),
    startedAt: toIsoTimestamp(execution.startedAt),
    completedAt: toIsoTimestamp(execution.completedAt),
    replayOf: execution.replayOf,
    errorMessage: execution.error?.message,
    logCount: execution.logs?.length ?? 0,
    failurePolicy: getJobFailurePolicy(execution),
  };
}

export function describeJob(execution: Execution): JobDetails {
  return {
    ...summarizeJob(execution),
    payload: execution.payload,
    result: execution.result,
    error: execution.error,
    metadata: execution.metadata,
    checkpoints: execution.checkpoints,
    progress: execution.progress,
    logs: execution.logs ?? [],
  };
}

export function createExecutionJobsOperations(manager: ExecutionJobsManager): JobsOperations {
  return {
    async list(options?: JobListOptions): Promise<JobListReport> {
      const inspectable = requireInspection(manager);
      const jobs = (await inspectable.list(options)).map(summarizeJob);
      const attentionCount = jobs.filter((job) => job.failurePolicy.needsAttention).length;

      return {
        summary: attentionCount > 0 ? "attention" : "healthy",
        generatedAt: new Date().toISOString(),
        total: jobs.length,
        attentionCount,
        jobs,
      };
    },

    async show(id: string): Promise<JobDetails> {
      const inspectable = requireInspection(manager);
      return describeJob(await inspectable.get(id));
    },

    async logs(id: string): Promise<readonly ExecutionLogEntry[]> {
      const inspectable = requireInspection(manager);
      const execution = await inspectable.get(id);
      return execution.logs ?? [];
    },

    async cancel(id: string, params: CancelJobParams = {}): Promise<JobDetails> {
      return describeJob(await manager.cancel(id, params.reason));
    },

    async replay(id: string, params: ReplayExecutionParams = {}): Promise<JobDetails> {
      const replayable = requireReplay(manager);
      return describeJob(await replayable.replay(id, params));
    },
  };
}

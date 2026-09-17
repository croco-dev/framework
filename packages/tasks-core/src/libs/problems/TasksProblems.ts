import { Problem, ProblemCategory } from "@croco/problems-core";

type SettledTaskExecutionStatus = "cancelled" | "failed" | "timed_out";

function recoveryActionFor(status: SettledTaskExecutionStatus): string {
  switch (status) {
    case "failed":
      return "Inspect the failure, then call TaskRunner.retry(executionId) if an attempt remains or submit a new idempotency key.";
    case "timed_out":
      return "Inspect external effects, then call TaskRunner.retry(executionId) or TaskRunner.recoverTimeout(executionId, reason) when safe.";
    case "cancelled":
      return "Submit the task with a new idempotency key to create a new execution.";
  }
}

export class TaskNotFoundProblem extends Problem {
  readonly code = "tasks-core/task-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(taskId: string) {
    super(undefined, undefined, `Task not found: '${taskId}'`);
  }
}

export class DuplicateTaskRegistrationProblem extends Problem {
  constructor(taskName: string) {
    super(
      "tasks-core/duplicate-task-registration",
      ProblemCategory.InternalServerError,
      `Task ${taskName} is already registered`,
      {
        extensions: {
          taskName,
          retryable: false,
        },
      },
    );
  }
}

export class InvalidTaskReferenceProblem extends Problem {
  constructor(taskName: string, reason: string) {
    super(
      "tasks-core/task-reference-invalid",
      ProblemCategory.InternalServerError,
      `Invalid task reference '${taskName}': ${reason}`,
      {
        extensions: {
          taskName,
          reason,
          retryable: false,
        },
      },
    );
  }
}

export class TaskRunnerDIFailureProblem extends Problem {
  constructor(taskName: string, cause: string) {
    super(
      "tasks-core/task-runner-di-failure",
      ProblemCategory.InternalServerError,
      `Failed to resolve task '${taskName}'`,
      {
        extensions: {
          taskName,
          cause,
          retryable: false,
        },
      },
    );
  }
}

export class TaskExecutionTimeoutProblem extends Problem {
  readonly executionId: string;
  readonly timeoutMs: number;
  readonly retryable: boolean;

  constructor(executionId: string, timeoutMs: number, retryable = false) {
    super(
      "tasks-core/execution-timeout",
      ProblemCategory.InternalServerError,
      `Task execution '${executionId}' timed out after ${timeoutMs}ms`,
      {
        extensions: {
          executionId,
          timeoutMs,
          retryable,
          indeterminate: !retryable,
          ...(!retryable
            ? {
                recoveryAction:
                  "Inspect external effects, then call `TaskRunner.recoverTimeout(executionId, reason)` to resume explicitly.",
              }
            : {}),
        },
      },
    );
    this.executionId = executionId;
    this.timeoutMs = timeoutMs;
    this.retryable = retryable;
  }
}

export class TaskExecutionAlreadySettledProblem extends Problem {
  readonly executionId: string;
  readonly executionStatus: SettledTaskExecutionStatus;

  constructor(taskId: string, executionId: string, status: SettledTaskExecutionStatus) {
    super(
      "tasks-core/execution-already-settled",
      ProblemCategory.Conflict,
      `Idempotent task '${taskId}' is already associated with execution '${executionId}' in '${status}' status`,
      {
        extensions: {
          taskId,
          executionId,
          executionStatus: status,
          retryable: false,
          recoveryAction: recoveryActionFor(status),
        },
      },
    );
    this.executionId = executionId;
    this.executionStatus = status;
  }
}

import { Problem, ProblemCategory } from "@croco/problems-core";

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

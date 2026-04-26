import { Problem, ProblemCategory } from '@croco/problems-core';

export class TaskNotFoundProblem extends Problem {
  readonly code = 'tasks-core/task-not-found';
  readonly category = ProblemCategory.NotFound;
  constructor(taskId: string) {
    super(undefined, undefined, `Task not found: '${taskId}'`);
  }
}

export class DuplicateTaskRegistrationProblem extends Problem {
  constructor(taskName: string) {
    super(
      'tasks-core/duplicate-task-registration',
      ProblemCategory.InternalServerError,
      `Task ${taskName} is already registered`,
      {
        extensions: {
          taskName,
          retryable: false,
        },
      }
    );
  }
}

export class TaskRunnerDIFailureProblem extends Problem {
  constructor(taskName: string, cause: string) {
    super(
      'tasks-core/task-runner-di-failure',
      ProblemCategory.InternalServerError,
      `Failed to resolve task '${taskName}'`,
      {
        extensions: {
          taskName,
          cause,
          retryable: false,
        },
      }
    );
  }
}

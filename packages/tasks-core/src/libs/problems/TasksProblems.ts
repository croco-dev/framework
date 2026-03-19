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

export class TaskDIResolutionProblem extends Problem {
  constructor(taskClassName: string, cause: Error) {
    super(
      'tasks-core/di-resolution-failed',
      ProblemCategory.InternalServerError,
      `Failed to resolve dependencies for task '${taskClassName}'. Ensure the class is decorated with @Component().`,
      {
        cause,
        extensions: {
          taskClassName,
          hint: 'Add @Component() decorator to the task class',
          retryable: false,
        },
      }
    );
  }
}

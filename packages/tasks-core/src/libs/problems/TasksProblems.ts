import { Problem, ProblemCategory } from '@croco/problems-core';

export class TaskNotFoundProblem extends Problem {
  readonly code = 'tasks-core/task-not-found';
  readonly category = ProblemCategory.NotFound;
  constructor(taskId: string) {
    super(undefined, undefined, `Task not found: '${taskId}'`);
  }
}

import { Problem, ProblemCategory } from '@croco/problems-core';

export class TaskNotFoundProblem extends Problem {
  constructor(taskId: string) {
    super('tasks-core/task-not-found', ProblemCategory.NotFound, `Task not found: '${taskId}'`);
  }
}

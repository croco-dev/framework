import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { DuplicateTaskRegistrationProblem, TaskNotFoundProblem } from '../libs/problems/TasksProblems';

describe('TasksProblems', () => {
  it('should create TaskNotFoundProblem with expected metadata', () => {
    const problem = new TaskNotFoundProblem('task-123');

    expect(problem.code).toBe('tasks-core/task-not-found');
    expect(problem.category).toBe(ProblemCategory.NotFound);
  });

  it('should create DuplicateTaskRegistrationProblem with expected metadata', () => {
    const problem = new DuplicateTaskRegistrationProblem('task-123');

    expect(problem.code).toBe('tasks-core/duplicate-task-registration');
    expect(problem.category).toBe(ProblemCategory.InternalServerError);

    const serialized = problem.toJSON();

    expect(serialized).toMatchObject({
      taskName: 'task-123',
      retryable: false,
    });
  });
});

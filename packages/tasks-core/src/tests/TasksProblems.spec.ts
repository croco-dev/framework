import { ProblemCategory } from '@croco/problems-core';
import { describe, expect, it } from 'vitest';
import { TaskNotFoundProblem } from '../libs/problems/TasksProblems';

describe('TasksProblems', () => {
  it('should create TaskNotFoundProblem with expected metadata', () => {
    const problem = new TaskNotFoundProblem('task-123');

    expect(problem.code).toBe('tasks-core/task-not-found');
    expect(problem.category).toBe(ProblemCategory.NotFound);
  });
});

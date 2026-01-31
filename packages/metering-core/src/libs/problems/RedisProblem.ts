import { Problem, ProblemCategory } from '@croco/problems-core';

export class RedisProblem extends Problem {
  constructor(operation: string, originalError?: Error) {
    super(
      'metering/redis-error',
      ProblemCategory.InternalServerError,
      `Redis operation '${operation}' failed: ${originalError?.message ?? 'Unknown error'}`,
      {
        extensions: {
          operation,
          originalMessage: originalError?.message,
        },
      }
    );
  }
}

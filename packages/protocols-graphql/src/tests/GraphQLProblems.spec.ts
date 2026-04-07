import { describe, expect, it } from 'vitest';
import {
  GraphQLAuthenticationProblem,
  GraphQLAuthorizationProblem,
  GraphQLInternalError,
  GraphQLNotFoundProblem,
  GraphQLValidationProblem,
  isProblem,
  problemToGraphQLError,
} from '../libs/errors';
import { GraphQLAuthGuard } from '../libs/guards/AuthGuard';
import type { TypedResolver } from '../libs/types/ResolverTypes';

describe('GraphQLProblems', () => {
  it('should create validation problem with correct category', () => {
    const problem = new GraphQLValidationProblem('VALIDATION_ERROR', 'Invalid input', {
      field: 'email',
    });

    expect(problem.code).toBe('VALIDATION_ERROR');
    expect(problem.status).toBe(422);
    expect(problem.title).toBe('Validation Error');
    expect(problem.extensions).toEqual({ field: 'email' });
  });

  it('should create authorization problem with correct category', () => {
    const problem = new GraphQLAuthorizationProblem('ACCESS_DENIED', 'Access denied');

    expect(problem.code).toBe('ACCESS_DENIED');
    expect(problem.status).toBe(403);
  });

  it('should create authentication problem with correct category', () => {
    const problem = new GraphQLAuthenticationProblem('UNAUTHORIZED', 'Unauthorized');

    expect(problem.code).toBe('UNAUTHORIZED');
    expect(problem.status).toBe(401);
  });

  it('should create not found problem with detail', () => {
    const problem = new GraphQLNotFoundProblem('User', '123');

    expect(problem.code).toBe('GRAPHQL_NOT_FOUND');
    expect(problem.status).toBe(404);
    expect(problem.detail).toContain('User');
    expect(problem.detail).toContain('123');
  });

  it('should create not found problem without id', () => {
    const problem = new GraphQLNotFoundProblem('User');

    expect(problem.detail).toBe('User not found');
  });

  it('should create internal error with cause', () => {
    const cause = new Error('Original error');
    const problem = new GraphQLInternalError('INTERNAL_ERROR', 'Something went wrong', cause);

    expect(problem.code).toBe('INTERNAL_ERROR');
    expect(problem.status).toBe(500);
    expect(problem.cause).toBe(cause);
  });
});

describe('ErrorConverter', () => {
  it('should convert problem to GraphQL error', () => {
    const problem = new GraphQLValidationProblem('VALIDATION_ERROR', 'Invalid input');
    const error = problemToGraphQLError(problem);

    expect(error.extensions).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      title: 'Validation Error',
    });
  });

  it('should include path in GraphQL error', () => {
    const problem = new GraphQLNotFoundProblem('User', '123');
    const path = ['users', 'getById'];
    const error = problemToGraphQLError(problem, path);

    expect(error.path).toEqual(path);
  });

  it('should identify problem instances', () => {
    const problem = new GraphQLValidationProblem('TEST', 'test');
    expect(isProblem(problem)).toBe(true);
  });

  it('should identify non-problem errors', () => {
    expect(isProblem(new Error())).toBe(false);
    expect(isProblem(null)).toBe(false);
    expect(isProblem('string')).toBe(false);
  });
});

describe('TypedResolver', () => {
  it('should type resolver correctly', async () => {
    type User = { id: string; name: string };
    type CreateUserArgs = { name: string };
    type Context = { requestId: string };

    const resolver: TypedResolver<unknown, Context, CreateUserArgs, User> = async (_source, args, _context) => {
      return { id: '1', name: args.name };
    };

    const result = await resolver({}, { name: 'Test' }, { requestId: '123' }, {});
    expect(result.name).toBe('Test');
  });
});

import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../libs/filters/HttpExceptionFilter';
import type { ExecutionContext } from '../libs/interfaces/ExecutionContext';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockContext = {
      getRequest: vi.fn(),
      getClass: vi.fn(),
      getHandler: vi.fn(),
      getPath: vi.fn(),
      getMethod: vi.fn(),
    } as unknown as ExecutionContext;
  });

  it('should convert Problem to RFC 7807 response', () => {
    const problem = {
      status: 404,
      toJSON: () => ({
        type: 'not-found',
        title: 'Not Found',
        status: 404,
        code: 'NOT_FOUND',
        detail: 'Resource not found',
      }),
    };

    const result = filter.catch(problem, mockContext);

    expect(result).toEqual({
      status: 404,
      headers: { 'Content-Type': 'application/problem+json' },
      body: {
        type: 'not-found',
        title: 'Not Found',
        status: 404,
        code: 'NOT_FOUND',
        detail: 'Resource not found',
      },
    });
  });

  it('should handle non-Problem errors with 500 status', () => {
    const error = new Error('Something went wrong');

    const result = filter.catch(error, mockContext);

    expect(result).toEqual({
      status: 500,
      headers: { 'Content-Type': 'application/problem+json' },
      body: {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        detail: 'Something went wrong',
      },
    });
  });

  it('should set correct Content-Type header', () => {
    const problem = {
      status: 400,
      toJSON: () => ({ type: 'bad-request', status: 400 }),
    };

    const result = filter.catch(problem, mockContext);

    expect(result.headers).toEqual({ 'Content-Type': 'application/problem+json' });
  });

  it('should handle Problem with custom status code', () => {
    const problem = {
      status: 422,
      toJSON: () => ({
        type: 'validation-error',
        title: 'Validation Error',
        status: 422,
        code: 'VALIDATION_ERROR',
        detail: 'Invalid input',
      }),
    };

    const result = filter.catch(problem, mockContext);

    expect(result.status).toBe(422);
    expect(result.body.status).toBe(422);
  });

  it('should handle Error with message', () => {
    const error = new Error('Database connection failed');

    const result = filter.catch(error, mockContext);

    expect(result.body.detail).toBe('Database connection failed');
    expect(result.body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should handle non-Error non-Problem exceptions', () => {
    const exception = 'string error';

    const result = filter.catch(exception, mockContext);

    expect(result.status).toBe(500);
    expect(result.body.detail).toBe('Internal Server Error');
  });

  it('should handle null exception', () => {
    const result = filter.catch(null, mockContext);

    expect(result.status).toBe(500);
    expect(result.body.detail).toBe('Internal Server Error');
  });

  it('should handle undefined exception', () => {
    const result = filter.catch(undefined, mockContext);

    expect(result.status).toBe(500);
    expect(result.body.detail).toBe('Internal Server Error');
  });

  it('should handle object without status property (non-Problem)', () => {
    const error = { message: 'Custom error object' };

    const result = filter.catch(error, mockContext);

    expect(result.status).toBe(500);
    expect(result.body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should handle object with status but without toJSON (non-Problem)', () => {
    const error = { status: 400 };

    const result = filter.catch(error, mockContext);

    expect(result.status).toBe(500);
    expect(result.body.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should preserve all Problem fields in body', () => {
    const problem = {
      status: 403,
      toJSON: () => ({
        type: 'forbidden',
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        detail: 'Access denied',
        instance: '/api/resource',
        additionalField: 'extra data',
      }),
    };

    const result = filter.catch(problem, mockContext);

    expect(result.body).toEqual({
      type: 'forbidden',
      title: 'Forbidden',
      status: 403,
      code: 'FORBIDDEN',
      detail: 'Access denied',
      instance: '/api/resource',
      additionalField: 'extra data',
    });
  });

  it('should use default message for Error without message', () => {
    const error = new Error();

    const result = filter.catch(error, mockContext);

    expect(result.body.detail).toBe('');
  });

  it('should handle empty string error', () => {
    const result = filter.catch('', mockContext);

    expect(result.body.detail).toBe('Internal Server Error');
  });

  it('should return consistent response structure', () => {
    const problem = {
      status: 401,
      toJSON: () => ({
        type: 'unauthorized',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        detail: 'Authentication required',
      }),
    };

    const result = filter.catch(problem, mockContext);

    expect(Object.keys(result)).toEqual(['status', 'headers', 'body']);
    expect(Object.keys(result.headers)).toEqual(['Content-Type']);
  });
});

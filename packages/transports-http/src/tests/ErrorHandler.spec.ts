import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import type { Logger } from '@croco/framework-logger';
import { Problem, ProblemCategory } from '@croco/problems-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ErrorHandler } from '../libs/ErrorHandler';
import type { CrocoHttpContext } from '../libs/types';

class TestProblem extends Problem {
  constructor(detail?: string, options?: { extensions?: Record<string, unknown> }) {
    super('test/error', ProblemCategory.BadRequest, detail, options);
  }
}

describe('ErrorHandler', () => {
  let errorHandler!: ErrorHandler;
  let mockCtx!: CrocoHttpContext;
  let mockLogger!: Logger;

  beforeEach(() => {
    Container.reset();

    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;

    errorHandler = new ErrorHandler(mockLogger);

    mockCtx = {
      req: {
        url: '/test',
        method: 'GET',
        headers: new Headers(),
      },
      jsonResponse: (body: unknown, status: number) => {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/problem+json' },
        });
      },
    } as unknown as CrocoHttpContext;
  });

  describe('RFC 7807 Standard Field Protection', () => {
    it('should protect standard fields from extensions override', async () => {
      const problem = new TestProblem('Test error', {
        extensions: {
          type: 'https://malicious.example.com/error',
          title: 'Hacked Title',
          status: 999,
          code: 'HACKED_CODE',
          detail: 'Hacked detail',
          instance: '/hacked',
          customField: 'custom-value',
          anotherField: 123,
        },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = (await response.json()) as {
        type: string;
        title: string;
        status: number;
        code: string;
        detail: string;
        instance: string | undefined;
        customField: string;
        anotherField: number;
      };

      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.status).toBe(400);
      expect(body.code).toBe('test/error');
      expect(body.detail).toBe('Test error');
      expect(body.instance).toBe('/test');
      expect(body.customField).toBe('custom-value');
      expect(body.anotherField).toBe(123);
    });

    it('should handle Problem without extensions', async () => {
      const problem = new TestProblem('Simple error');

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(body).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'test/error',
        detail: 'Simple error',
        instance: '/test',
      });
    });

    it('should handle Problem with safe extensions only', async () => {
      const problem = new TestProblem('Error with metadata', {
        extensions: {
          metadata: { key: 'value' },
          errors: ['field1', 'field2'],
          count: 3,
        },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      const body = await response.json();

      expect(body).toEqual({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        code: 'test/error',
        detail: 'Error with metadata',
        instance: '/test',
        metadata: { key: 'value' },
        errors: ['field1', 'field2'],
        count: 3,
      });
    });
  });

  describe('handleProblem', () => {
    it('should correctly map Problem category to HTTP status', async () => {
      const problem = new TestProblem('Not found', {
        extensions: { status: 404 },
      });

      const response = errorHandler.handleError(problem, mockCtx);
      expect(response.status).toBe(400);
    });
  });
});

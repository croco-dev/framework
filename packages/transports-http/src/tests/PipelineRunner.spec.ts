import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Problem, ProblemFactory } from '@croco/problems-core';
import type { ExceptionFilter } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorHandler } from '../libs/ErrorHandler';
import { HttpExecutionContext } from '../libs/HttpExecutionContext';
import { PipelineRunner } from '../libs/PipelineRunner';
import type { CrocoHttpContext } from '../libs/types';

function createMockHttpContext(): CrocoHttpContext {
  const request = new Request('http://localhost/test');

  const req = {
    method: 'GET',
    url: request.url,
    path: '/test',
    params: {},
    query: {},
    headers: {},
  };

  const res = {
    status: 200,
    headers: {},
  };

  return {
    req,
    res,
    raw: {
      req: {
        raw: request,
      },
    } as CrocoHttpContext['raw'],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn(),
    json: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    text: vi.fn().mockImplementation((body: string, status: number = 200) => new Response(body, { status })),
    jsonResponse: vi
      .fn()
      .mockImplementation((body: unknown, status: number = 200) => new Response(JSON.stringify(body), { status })),
    redirect: vi.fn().mockImplementation((url: string, status: number = 302) => Response.redirect(url, status)),
  };
}

describe('PipelineRunner', () => {
  let logger!: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    Container.reset();
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    Container.set(Logger, logger as unknown as Logger);
    Container.set(ErrorHandler, new ErrorHandler(logger as unknown as Logger));
  });

  it('BUG-03 Container 초기화 전 PipelineRunner 생성 가능', () => {
    Container.reset();
    expect(() => new PipelineRunner()).not.toThrow();
  });

  it('BUG-01 다중 ExceptionFilter 중 매칭 필터 실행', async () => {
    const runner = new PipelineRunner();
    const execContext = new HttpExecutionContext(createMockHttpContext(), class TestController {}, 'handler');
    const httpProblem = ProblemFactory.badRequest('BAD_REQUEST', 'bad request');

    const httpProblemFilter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation((error: unknown) => {
        if (error instanceof Problem) {
          return 'http-problem-filter';
        }
        throw error;
      }),
    };

    const genericFilter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockReturnValue('generic-filter'),
    };

    const httpProblemResult = await runner.run(
      execContext,
      async () => {
        throw httpProblem;
      },
      {
        guards: [],
        interceptors: [],
        filters: [httpProblemFilter, genericFilter],
      }
    );

    expect(httpProblemResult).toBe('http-problem-filter');
    expect(httpProblemFilter.catch).toHaveBeenCalledTimes(1);
    expect(genericFilter.catch).not.toHaveBeenCalled();

    const genericErrorResult = await runner.run(
      execContext,
      async () => {
        throw new TypeError('generic failure');
      },
      {
        guards: [],
        interceptors: [],
        filters: [httpProblemFilter, genericFilter],
      }
    );

    expect(genericErrorResult).toBe('generic-filter');
    expect(httpProblemFilter.catch).toHaveBeenCalledTimes(2);
    expect(genericFilter.catch).toHaveBeenCalledTimes(1);
  });

  it('BUG-02 ErrorHandler가 Logger를 가져야 함', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    Container.set(Logger, logger as unknown as Logger);
    Container.set(ErrorHandler, new ErrorHandler(logger as unknown as Logger));

    const runner = new PipelineRunner();
    const execContext = new HttpExecutionContext(createMockHttpContext(), class TestController {}, 'handler');

    const result = await runner.run(
      execContext,
      async () => {
        throw new TypeError('boom');
      },
      {
        guards: [],
        interceptors: [],
        filters: [],
      }
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(500);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('should preserve the original business error when a filter throws', async () => {
    const runner = new PipelineRunner();
    const execContext = new HttpExecutionContext(createMockHttpContext(), class TestController {}, 'handler');
    const originalProblem = ProblemFactory.badRequest('BAD_REQUEST', 'original business error');

    const brokenFilter: ExceptionFilter<unknown, HttpExecutionContext> = {
      catch: vi.fn().mockImplementation(() => {
        throw new Error('filter failure');
      }),
    };

    const result = await runner.run(
      execContext,
      async () => {
        throw originalProblem;
      },
      {
        guards: [],
        interceptors: [],
        filters: [brokenFilter],
      }
    );

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
    expect(await (result as Response).json()).toMatchObject({
      code: 'BAD_REQUEST',
      detail: 'original business error',
      status: 400,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Exception filter threw while handling an error; preserving original error',
      {
        originalError: 'original business error',
        filterError: 'filter failure',
      }
    );
  });
});

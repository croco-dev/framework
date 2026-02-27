import 'reflect-metadata';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggingInterceptor } from '../libs/interceptors/LoggingInterceptor';
import type { CallHandler } from '../libs/interfaces/CallHandler';
import type { ExecutionContext } from '../libs/interfaces/ExecutionContext';

describe('LoggingInterceptor', () => {
  let interceptor!: LoggingInterceptor;
  let mockContext!: ExecutionContext;
  let mockNext!: CallHandler;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    vi.spyOn(console, 'log').mockImplementation(() => {});

    mockContext = {
      getRequest: vi.fn(),
      getClass: vi.fn(),
      getHandler: vi.fn(),
      getPath: vi.fn().mockReturnValue('/test/path'),
      getMethod: vi.fn().mockReturnValue('GET'),
    } as unknown as ExecutionContext;

    mockNext = {
      handle: vi.fn(),
    } as unknown as CallHandler;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log request method and path', async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: 'test' });

    await interceptor.intercept(mockContext, mockNext);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('GET /test/path'));
  });

  it('should log duration after handler completes', async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      return new Promise((resolve) => setTimeout(() => resolve({}), 10));
    });

    await interceptor.intercept(mockContext, mockNext);

    const logCall = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(logCall).toMatch(/\d+ ms/);
  });

  it('should pass through handler result', async () => {
    const expectedResult = { data: 'test-result', id: 123 };
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await interceptor.intercept(mockContext, mockNext);

    expect(result).toEqual(expectedResult);
  });

  it('should log different HTTP methods', async () => {
    (mockContext.getMethod as ReturnType<typeof vi.fn>).mockReturnValue('POST');
    (mockContext.getPath as ReturnType<typeof vi.fn>).mockReturnValue('/api/users');
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('POST /api/users'));
  });

  it('should handle long path strings', async () => {
    const longPath = '/api/v1/users/123/posts/456/comments/789';
    (mockContext.getPath as ReturnType<typeof vi.fn>).mockReturnValue(longPath);
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining(longPath));
  });

  it('should work with different HTTP verbs', async () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    for (const method of methods) {
      (mockContext.getMethod as ReturnType<typeof vi.fn>).mockReturnValue(method);
      (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await interceptor.intercept(mockContext, mockNext);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining(method));
    }
  });

  it('should round duration to nearest millisecond', async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    const logCall = vi.mocked(console.log).mock.calls[0][0] as string;
    const durationMatch = logCall.match(/(\d+) ms/);

    expect(durationMatch).not.toBeNull();
    if (!durationMatch || !durationMatch[1]) {
      throw new Error('Duration match not found');
    }
    const duration = Number.parseInt(durationMatch[1], 10);
    expect(Number.isInteger(duration)).toBe(true);
  });

  it('should maintain log format: [HTTP] METHOD PATH - DURATION ms', async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    const logCall = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(logCall).toMatch(/^\[HTTP\] \w+ .+ - \d+ ms$/);
  });

  it('should work even when handler returns undefined', async () => {
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await interceptor.intercept(mockContext, mockNext);

    expect(result).toBeUndefined();
    expect(console.log).toHaveBeenCalled();
  });

  it('should log for DELETE method', async () => {
    (mockContext.getMethod as ReturnType<typeof vi.fn>).mockReturnValue('DELETE');
    (mockContext.getPath as ReturnType<typeof vi.fn>).mockReturnValue('/api/items/123');
    (mockNext.handle as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await interceptor.intercept(mockContext, mockNext);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DELETE /api/items/123'));
  });
});

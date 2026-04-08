import type { Context as HonoContext } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpContext } from '../libs/HttpContext';
import { telemetryMiddleware } from '../libs/middleware/telemetry';

describe('TelemetryMiddleware', () => {
  const createContext = (): HttpContext => {
    const mockCtx = {
      req: {
        method: 'GET',
        url: 'https://example.com/health',
        path: '/health',
        raw: {
          headers: new Headers(),
        },
        param: vi.fn(),
        query: vi.fn(),
        header: vi.fn(),
        json: vi.fn(),
      },
      text: vi.fn(),
      json: vi.fn(),
      redirect: vi.fn(),
    };

    return new HttpContext(mockCtx as unknown as HonoContext);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should continue request and mark degraded mode when telemetry setup fails', async () => {
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    const middleware = telemetryMiddleware('/health');
    const headerSpy = vi.spyOn(ctx, 'header').mockImplementation(() => {
      throw new Error('header access failure');
    });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.get('telemetryDegraded')).toBe(true);
    expect(ctx.get('traceId')).toMatch(/^telemetry-degraded-/);

    headerSpy.mockRestore();
  });
});

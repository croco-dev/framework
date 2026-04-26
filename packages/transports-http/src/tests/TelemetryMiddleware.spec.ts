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

  it('should mark degraded mode without re-entering pipeline when telemetry setup fails', async () => {
    const ctx = createContext();
    const next = vi.fn().mockResolvedValue(undefined);

    const middleware = telemetryMiddleware('/health');
    const headerSpy = vi.spyOn(ctx, 'header').mockImplementation(() => {
      throw new Error('header access failure');
    });

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.get('telemetryDegraded')).toBe(true);
    expect(ctx.get('traceId')).toMatch(/^telemetry-degraded-/);

    headerSpy.mockRestore();
  });

  it('should not call next twice when downstream throws after span setup', async () => {
    const ctx = createContext();
    const nextError = new Error('downstream failure');
    const next = vi.fn().mockRejectedValue(nextError);

    const middleware = telemetryMiddleware('/health');

    await expect(middleware(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.get('telemetryDegraded')).toBe(true);
    expect(ctx.get('traceId')).toMatch(/^telemetry-degraded-/);
  });
});

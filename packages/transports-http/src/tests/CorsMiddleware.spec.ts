import { describe, expect, it, vi } from 'vitest';
import { type CorsOptions, corsMiddleware } from '../libs/middleware/CorsMiddleware';
import type { CrocoHttpContext } from '../libs/types';

function createMockContext(method: string, origin?: string): CrocoHttpContext {
  const headers: Record<string, string> = {};
  if (origin) {
    headers['origin'] = origin;
  }

  const resHeaders: Record<string, string> = {};

  return {
    req: {
      method,
      url: 'https://api.example.com/test',
      path: '/test',
      params: {},
      query: {},
      headers,
    },
    res: {
      status: 200,
      headers: resHeaders,
    },
    raw: {
      header: vi.fn((name: string, value: string) => {
        resHeaders[name] = value;
      }),
    } as unknown as CrocoHttpContext['raw'],
    param: vi.fn(),
    query: vi.fn(),
    header: vi.fn((name: string) => headers[name.toLowerCase()]),
    json: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    text: vi.fn(),
    jsonResponse: vi.fn(),
    redirect: vi.fn(),
  };
}

describe('corsMiddleware', () => {
  const defaultOptions: CorsOptions = {
    origins: ['https://example.com', 'https://app.example.com'],
  };

  it('should add CORS headers for allowed origin', async () => {
    const ctx = createMockContext('GET', 'https://example.com');
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'https://example.com');
    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', expect.any(String));
  });

  it('should not add CORS headers for disallowed origin', async () => {
    const ctx = createMockContext('GET', 'https://malicious.com');
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).not.toHaveBeenCalled();
  });

  it('should not add CORS headers when origin header is missing', async () => {
    const ctx = createMockContext('GET');
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.raw.header).not.toHaveBeenCalled();
  });

  it('should handle preflight OPTIONS request with 204', async () => {
    const ctx = createMockContext('OPTIONS', 'https://example.com');
    const middleware = corsMiddleware(defaultOptions);
    const next = vi.fn();

    await middleware(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.res.status).toBe(204);
    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Max-Age', expect.any(String));
  });

  it('should use custom methods', async () => {
    const ctx = createMockContext('GET', 'https://example.com');
    const middleware = corsMiddleware({
      ...defaultOptions,
      methods: ['GET', 'POST'],
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST');
  });

  it('should add allowedHeaders when provided', async () => {
    const ctx = createMockContext('GET', 'https://example.com');
    const middleware = corsMiddleware({
      ...defaultOptions,
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  });

  it('should add credentials header when enabled', async () => {
    const ctx = createMockContext('GET', 'https://example.com');
    const middleware = corsMiddleware({
      ...defaultOptions,
      credentials: true,
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
  });

  it('should use custom maxAge for preflight', async () => {
    const ctx = createMockContext('OPTIONS', 'https://example.com');
    const middleware = corsMiddleware({
      ...defaultOptions,
      maxAge: 3600,
    });
    const next = vi.fn();

    await middleware(ctx, next);

    expect(ctx.raw.header).toHaveBeenCalledWith('Access-Control-Max-Age', '3600');
  });
});

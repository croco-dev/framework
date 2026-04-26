import 'reflect-metadata';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Container, Context as FrameworkContext } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Body, Controller, Get, Param, Post, Raw } from '@croco/protocols-rest';
import {
  createSlidingWindowPolicy,
  RateLimiter,
  RateLimitKeyBuilder,
  SlidingWindowInMemoryStore,
} from '@croco/ratelimit-core';
import { serve } from '@hono/node-server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../libs/CrocoApp';
import { CrocoRouteRegistrar } from '../libs/CrocoRouteRegistrar';
import { ErrorHandler } from '../libs/ErrorHandler';
import { HealthCheckRegistry } from '../libs/HealthCheckRegistry';
import { bodyLimitMiddleware, mb } from '../libs/middleware/BodyLimitMiddleware';
import { corsMiddleware } from '../libs/middleware/CorsMiddleware';
import { rateLimitHttpMiddleware } from '../libs/middleware/RateLimitMiddleware';
import { securityHeadersMiddleware } from '../libs/middleware/SecurityHeadersMiddleware';
import type { LambdaContext, LambdaEvent } from '../libs/types';

vi.mock('@hono/node-server', () => ({
  serve: vi.fn((_options: unknown, callback?: () => void) => {
    callback?.();
    return {};
  }),
}));

describe('CrocoApp', () => {
  beforeEach(() => {
    Container.reset();
    vi.mocked(serve).mockClear();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  @Controller('/api')
  class TestController {
    @Get('/hello')
    hello() {
      return { message: 'Hello, World!' };
    }

    @Get('/users/:id')
    getUser(@Param('id') id: string) {
      return { id, name: 'Test User' };
    }

    @Post('/users')
    createUser(@Body() body: unknown) {
      return { created: true, data: body };
    }
  }

  @Controller('/lambda')
  class LambdaController {
    @Post('/binary-echo')
    async binaryEcho(@Raw() raw: unknown): Promise<Response> {
      const request = (raw as { req: { raw: Request } }).req.raw;
      const body = await request.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'image/png',
        },
      });
    }

    @Get('/trace-context')
    getTraceContext(): Record<string, string | null> {
      const context = FrameworkContext.get() as {
        traceId?: string;
        spanId?: string;
        traceFlags?: string;
      } | null;

      return {
        traceId: context?.traceId ?? null,
        spanId: context?.spanId ?? null,
        traceFlags: context?.traceFlags ?? null,
      };
    }

    @Get('/event-metadata')
    getEventMetadata(@Raw() raw: unknown) {
      const env =
        typeof raw === 'object' && raw !== null && 'env' in raw
          ? (
              raw as {
                env?: {
                  event?: {
                    cookies?: string[];
                    requestContext?: {
                      stage?: string;
                      authorizer?: Record<string, unknown>;
                    };
                  };
                  lambdaContext?: {
                    awsRequestId?: string;
                  };
                };
              }
            ).env
          : undefined;

      return {
        stage: env?.event?.requestContext?.stage ?? null,
        cookies: env?.event?.cookies ?? [],
        authorizer: env?.event?.requestContext?.authorizer ?? null,
        awsRequestId: env?.lambdaContext?.awsRequestId ?? null,
      };
    }
  }

  const lambdaContext: LambdaContext = {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:ap-northeast-2:123456789012:function:test-function',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2026/03/17/[$LATEST]abcdef',
    memoryLimitInMB: '128',
    awsRequestId: 'req-123',
    done: () => undefined,
    getRemainingTimeInMillis: () => 5000,
    fail: () => undefined,
    succeed: () => undefined,
  };

  function createLambdaEvent(overrides: Partial<LambdaEvent> = {}): LambdaEvent {
    return {
      version: '2.0',
      routeKey: '$default',
      rawPath: '/',
      rawQueryString: '',
      headers: {},
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-123',
        domainName: 'example.execute-api.ap-northeast-2.amazonaws.com',
        domainPrefix: 'example',
        http: {
          method: 'GET',
          path: '/',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'vitest',
        },
        requestId: 'gateway-req-123',
        routeKey: '$default',
        stage: '$default',
        time: '17/Mar/2026:12:00:00 +0000',
        timeEpoch: 1710676800000,
      },
      isBase64Encoded: false,
      ...overrides,
    };
  }

  function createRequiredSecurityMiddlewares() {
    const rateLimiter = new RateLimiter(new SlidingWindowInMemoryStore(), new RateLimitKeyBuilder(['ip']), {
      failOpen: false,
    });

    return [
      securityHeadersMiddleware(),
      corsMiddleware({ origins: ['https://example.com'] }),
      bodyLimitMiddleware({ limit: mb(1) }),
      rateLimitHttpMiddleware({
        rateLimiter,
        policy: createSlidingWindowPolicy('test', 100, 60000),
      }),
    ];
  }

  async function createStaticFixture(files: Record<string, string>): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'croco-transports-http-'));

    await Promise.all(
      Object.entries(files).map(async ([filePath, contents]) => {
        const absolutePath = join(directory, filePath);
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, contents);
      })
    );

    return directory;
  }

  it('should handle GET request', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/hello'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ message: 'Hello, World!' });
  });

  it('should bootstrap when all required security middlewares are configured', async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: createRequiredSecurityMiddlewares(),
    });

    const response = await app.fetch(new Request('http://localhost/api/hello'));

    expect(response.status).toBe(200);
  });

  it('should fail bootstrap when required security middlewares are missing', () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [securityHeadersMiddleware()],
      securityValidation: 'enforce',
    });

    expect(() => app.lambdaHandler()).toThrow(/Missing required security middleware/);
  });

  it('should allow bootstrap when securityValidation is set to off', async () => {
    const app = createApp({
      controllers: [TestController],
      middlewares: [securityHeadersMiddleware()],
      securityValidation: 'off',
    });

    const response = await app.fetch(new Request('http://localhost/api/hello'));

    expect(response.status).toBe(200);
  });

  it('should extract path params', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/users/123'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ id: '123', name: 'Test User' });
  });

  it('should return headers without a response body for HEAD requests', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/hello', { method: 'HEAD' }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('should handle POST with body', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New User' }),
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.created).toBe(true);
    expect(json.data).toEqual({ name: 'New User' });
  });

  it('should return 404 for unknown routes', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/unknown'));

    expect(response.status).toBe(404);
  });

  it('should serve static assets and keep listen callback compatibility', async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      'index.html': '<html><body>spa</body></html>',
      'assets/app.js': 'console.log("app")',
    });
    const callback = vi.fn();

    try {
      await app.listen(3000, callback);

      expect(vi.mocked(serve)).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);

      await app.listen(3001, { staticDir, spaFallback: true }, callback);

      expect(vi.mocked(serve)).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenCalledTimes(2);

      const assetResponse = await app.fetch(new Request('http://localhost/assets/app.js'));

      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get('content-type')).toContain('text/javascript');
      expect(await assetResponse.text()).toContain('console.log');
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it('should return index.html for SPA routes when fallback is enabled', async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      'index.html': '<html><body>spa shell</body></html>',
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const response = await app.fetch(
        new Request('http://localhost/dashboard', {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        })
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(await response.text()).toContain('spa shell');

      const apiResponse = await app.fetch(new Request('http://localhost/api/hello'));

      expect(apiResponse.status).toBe(200);
      expect(await apiResponse.json()).toEqual({ message: 'Hello, World!' });
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it('should not use SPA fallback for extension paths or non-html accept headers', async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      'index.html': '<html><body>spa shell</body></html>',
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const assetLikeResponse = await app.fetch(
        new Request('http://localhost/missing.js', {
          headers: { Accept: 'text/html' },
        })
      );

      const jsonResponse = await app.fetch(
        new Request('http://localhost/dashboard', {
          headers: { Accept: 'application/json' },
        })
      );

      expect(assetLikeResponse.status).toBe(404);
      expect(jsonResponse.status).toBe(404);
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it('should return 404 for missing assets inside asset directories', async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      'index.html': '<html><body>spa shell</body></html>',
      'assets/app.js': 'console.log("app")',
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const response = await app.fetch(
        new Request('http://localhost/assets/missing.js', {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        })
      );

      expect(response.status).toBe(404);
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it('should not return SPA html for application json requests', async () => {
    const app = createApp({ controllers: [TestController] });
    const staticDir = await createStaticFixture({
      'index.html': '<html><body>spa shell</body></html>',
    });

    try {
      await app.listen(3000, { staticDir, spaFallback: true });

      const response = await app.fetch(
        new Request('http://localhost/dashboard', {
          headers: { Accept: 'application/json' },
        })
      );

      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')?.includes('text/html') ?? false).toBe(false);
      expect(await response.text()).not.toContain('spa shell');
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });

  it('should preserve binary body through lambda request/response', async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();
    const binaryBody = Buffer.from([0xc3, 0x28, 0xff, 0xfe, 0x00, 0x61, 0x80]);

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-123',
          domainName: 'example.execute-api.ap-northeast-2.amazonaws.com',
          domainPrefix: 'example',
          http: {
            method: 'POST',
            path: '/lambda/binary-echo',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'vitest',
          },
          requestId: 'gateway-req-123',
          routeKey: '$default',
          stage: '$default',
          time: '17/Mar/2026:12:00:00 +0000',
          timeEpoch: 1710676800000,
        },
        rawPath: '/lambda/binary-echo',
        rawQueryString: '',
        headers: { 'content-type': 'application/octet-stream' },
        body: binaryBody.toString('base64'),
        isBase64Encoded: true,
      }),
      lambdaContext
    );

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBe(true);
    expect(response.body).not.toBeUndefined();

    const decoded = Buffer.from(response.body ?? '', 'base64');
    expect(Buffer.compare(decoded, binaryBody)).toBe(0);
  });

  it('should fail fast for unsupported route methods instead of registering all routes', () => {
    const hono = {
      all: () => {
        throw new Error('should not register unsupported methods as all');
      },
      get: () => {},
      post: () => {},
      put: () => {},
      patch: () => {},
      delete: () => {},
      options: () => {},
    };

    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;

    const registrar = new CrocoRouteRegistrar(hono as never, new ErrorHandler(logger), []);

    expect(() => {
      registrar.register({
        method: 'TRACE',
        path: '/trace',
        methodName: 'trace',
        handler: async () => undefined,
      });
    }).toThrow('Unsupported route method: TRACE');
  });

  it('should keep json lambda response behavior unchanged', async () => {
    const app = createApp({ controllers: [TestController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-123',
          domainName: 'example.execute-api.ap-northeast-2.amazonaws.com',
          domainPrefix: 'example',
          http: {
            method: 'GET',
            path: '/api/hello',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'vitest',
          },
          requestId: 'gateway-req-123',
          routeKey: '$default',
          stage: '$default',
          time: '17/Mar/2026:12:00:00 +0000',
          timeEpoch: 1710676800000,
        },
        rawPath: '/api/hello',
        rawQueryString: '',
        headers: { 'content-type': 'application/json' },
      }),
      lambdaContext
    );

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBe(false);
    expect(JSON.parse(response.body ?? '{}')).toEqual({ message: 'Hello, World!' });
  });

  it('should parse traceparent with traceId spanId and traceFlags', async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const spanId = '00f067aa0ba902b7';
    const traceFlagsHex = '01';
    const expectedTraceFlags = 1; // Number.parseInt('01', 16)

    const response = await handler(
      createLambdaEvent({
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-123',
          domainName: 'example.execute-api.ap-northeast-2.amazonaws.com',
          domainPrefix: 'example',
          http: {
            method: 'GET',
            path: '/lambda/trace-context',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'vitest',
          },
          requestId: 'gateway-req-123',
          routeKey: '$default',
          stage: '$default',
          time: '17/Mar/2026:12:00:00 +0000',
          timeEpoch: 1710676800000,
        },
        rawPath: '/lambda/trace-context',
        rawQueryString: '',
        headers: {
          traceparent: `00-${traceId}-${spanId}-${traceFlagsHex}`,
        },
      }),
      lambdaContext
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? '{}')).toEqual({
      traceId,
      spanId,
      traceFlags: expectedTraceFlags,
    });
  });

  it('should preserve lambda event metadata in raw hono env', async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      createLambdaEvent({
        version: '2.0',
        routeKey: 'GET /lambda/event-metadata',
        rawPath: '/lambda/event-metadata',
        rawQueryString: '',
        cookies: ['session=abc', 'theme=dark'],
        headers: { 'content-type': 'application/json' },
        requestContext: {
          accountId: '123456789012',
          apiId: 'api-123',
          domainName: 'example.execute-api.ap-northeast-2.amazonaws.com',
          domainPrefix: 'example',
          http: {
            method: 'GET',
            path: '/lambda/event-metadata',
            protocol: 'HTTP/1.1',
            sourceIp: '127.0.0.1',
            userAgent: 'vitest',
          },
          requestId: 'gateway-req-123',
          routeKey: 'GET /lambda/event-metadata',
          stage: '$default',
          time: '17/Mar/2026:12:00:00 +0000',
          timeEpoch: 1710676800000,
          authorizer: {
            jwt: {
              claims: {
                sub: 'user-123',
                tenantId: 'tenant-456',
              },
              scopes: ['read:users'],
            },
          },
        },
        isBase64Encoded: false,
      }),
      lambdaContext
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? '{}')).toEqual({
      stage: '$default',
      cookies: ['session=abc', 'theme=dark'],
      authorizer: {
        jwt: {
          claims: {
            sub: 'user-123',
            tenantId: 'tenant-456',
          },
          scopes: ['read:users'],
        },
      },
      awsRequestId: 'req-123',
    });
  });
});

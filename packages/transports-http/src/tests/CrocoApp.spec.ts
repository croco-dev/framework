import 'reflect-metadata';
import { Container, Context as FrameworkContext } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Body, Controller, Get, Param, Post, Raw } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../libs/CrocoApp';
import { ErrorHandler } from '../libs/ErrorHandler';
import { HealthCheckRegistry } from '../libs/HealthCheckRegistry';

describe('CrocoApp', () => {
  beforeEach(() => {
    Container.reset();
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
  }

  const lambdaContext = {
    functionName: 'test-function',
    awsRequestId: 'req-123',
    getRemainingTimeInMillis: () => 5000,
  };

  it('should handle GET request', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/hello'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ message: 'Hello, World!' });
  });

  it('should extract path params', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/users/123'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ id: '123', name: 'Test User' });
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

  it('should preserve binary body through lambda request/response', async () => {
    const app = createApp({ controllers: [LambdaController] });
    const handler = app.lambdaHandler();
    const binaryBody = Buffer.from([0xc3, 0x28, 0xff, 0xfe, 0x00, 0x61, 0x80]);

    const response = await handler(
      {
        requestContext: { http: { method: 'POST', path: '/lambda/binary-echo' } },
        rawPath: '/lambda/binary-echo',
        rawQueryString: '',
        headers: { 'content-type': 'application/octet-stream' },
        body: binaryBody.toString('base64'),
        isBase64Encoded: true,
      },
      lambdaContext
    );

    expect(response.statusCode).toBe(200);
    expect(response.isBase64Encoded).toBe(true);
    expect(response.body).toBeDefined();

    const decoded = Buffer.from(response.body ?? '', 'base64');
    expect(Buffer.compare(decoded, binaryBody)).toBe(0);
  });

  it('should keep json lambda response behavior unchanged', async () => {
    const app = createApp({ controllers: [TestController] });
    const handler = app.lambdaHandler();

    const response = await handler(
      {
        requestContext: { http: { method: 'GET', path: '/api/hello' } },
        rawPath: '/api/hello',
        rawQueryString: '',
        headers: { 'content-type': 'application/json' },
      },
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
    const traceFlags = '01';

    const response = await handler(
      {
        requestContext: { http: { method: 'GET', path: '/lambda/trace-context' } },
        rawPath: '/lambda/trace-context',
        rawQueryString: '',
        headers: {
          traceparent: `00-${traceId}-${spanId}-${traceFlags}`,
        },
      },
      lambdaContext
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body ?? '{}')).toEqual({
      traceId,
      spanId,
      traceFlags,
    });
  });
});

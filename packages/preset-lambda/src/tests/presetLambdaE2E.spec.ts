import type { LambdaContext, LambdaEvent } from '@croco/transports-http';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createLambdaHandler } from '../index';

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
  fail: () => undefined,
  getRemainingTimeInMillis: () => 5000,
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

function createRequestContext(method: string, path: string): LambdaEvent['requestContext'] {
  const baseEvent = createLambdaEvent();

  return {
    ...baseEvent.requestContext,
    http: {
      ...baseEvent.requestContext.http,
      method,
      path,
    },
  };
}

describe('createLambdaHandler E2E', () => {
  it('handles GET requests with query strings', async () => {
    const app = new Hono();
    app.get('/test', (c) => {
      return c.json(
        {
          keyword: c.req.query('keyword'),
          page: c.req.query('page'),
        },
        200,
        {
          'x-test': 'query',
        }
      );
    });
    const handler = createLambdaHandler(app);

    const response = await handler(
      createLambdaEvent({
        rawPath: '/test',
        rawQueryString: 'keyword=croco&page=1',
        headers: {
          accept: 'application/json',
        },
        requestContext: createRequestContext('GET', '/test'),
      }),
      lambdaContext
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-test': 'query',
      },
      body: JSON.stringify({ keyword: 'croco', page: '1' }),
      isBase64Encoded: false,
    });
  });

  it('handles POST requests with JSON bodies', async () => {
    const app = new Hono();
    app.post('/items', async (c) => {
      const body = await c.req.json();

      return c.json({ received: body }, 201);
    });
    const handler = createLambdaHandler(app);

    const response = await handler(
      createLambdaEvent({
        rawPath: '/items',
        rawQueryString: '',
        headers: {
          'content-type': 'application/json',
        },
        requestContext: createRequestContext('POST', '/items'),
        body: JSON.stringify({ name: 'croco' }),
      }),
      lambdaContext
    );

    expect(response).toEqual({
      statusCode: 201,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ received: { name: 'croco' } }),
      isBase64Encoded: false,
    });
  });

  it('passes cookie headers to Hono routes', async () => {
    const app = new Hono();
    app.get('/cookies', (c) => c.json({ cookie: c.req.header('cookie') ?? null }));
    const handler = createLambdaHandler(app);

    const response = await handler(
      createLambdaEvent({
        rawPath: '/cookies',
        rawQueryString: '',
        headers: {
          cookie: 'session=abc; theme=dark',
        },
        requestContext: createRequestContext('GET', '/cookies'),
      }),
      lambdaContext
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ cookie: 'session=abc; theme=dark' }),
      isBase64Encoded: false,
    });
  });

  it('decodes base64 encoded binary request bodies', async () => {
    const app = new Hono();
    app.post('/binary', async (c) => {
      const body = Buffer.from(await c.req.arrayBuffer()).toString('utf8');

      return c.text(body);
    });
    const handler = createLambdaHandler(app);

    const response = await handler(
      createLambdaEvent({
        rawPath: '/binary',
        rawQueryString: '',
        headers: {
          'content-type': 'application/octet-stream',
        },
        requestContext: createRequestContext('POST', '/binary'),
        body: Buffer.from('binary-payload').toString('base64'),
        isBase64Encoded: true,
      }),
      lambdaContext
    );

    expect(response).toEqual({
      statusCode: 200,
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
      },
      body: 'binary-payload',
      isBase64Encoded: false,
    });
  });

  it('returns 404 for missing routes', async () => {
    const app = new Hono();
    app.get('/known', (c) => c.text('ok'));
    const handler = createLambdaHandler(app);

    const response = await handler(
      createLambdaEvent({
        rawPath: '/missing',
        rawQueryString: '',
        requestContext: createRequestContext('GET', '/missing'),
      }),
      lambdaContext
    );

    expect(response.statusCode).toBe(404);
    expect(response.headers).toEqual({
      'content-type': 'text/plain; charset=UTF-8',
    });
    expect(response.body).toBe('404 Not Found');
    expect(response.isBase64Encoded).toBe(false);
  });
});

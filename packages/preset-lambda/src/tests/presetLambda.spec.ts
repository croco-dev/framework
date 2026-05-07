import { describe, expect, it } from 'vitest';
import type { LambdaContext, LambdaEvent } from '@croco/transports-http';
import { createLambdaHandler, createLambdaPreset } from '../index';

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

describe('createLambdaPreset', () => {
  it('returns a lambda preset', () => {
    const preset = createLambdaPreset();

    expect(preset.name).toBe('lambda');
    expect(preset.config.name).toBe('lambda');
  });

  it('uses the Lambda handler entry point', () => {
    const preset = createLambdaPreset();

    expect(preset.config.entry).toBe('./handler.js');
  });
});

describe('createLambdaHandler', () => {
  it('creates a Lambda handler function', () => {
    const handler = createLambdaHandler({
      fetch: async () => new Response('ok'),
    });

    expect(typeof handler).toBe('function');
  });

  it('handles a GET event', async () => {
    const handler = createLambdaHandler({
      fetch: async (request: Request) => {
        expect(request.method).toBe('GET');
        expect(request.url).toBe('https://lambda.local/users?name=croco');

        return new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'text/plain',
          },
        });
      },
    });
    const event = createLambdaEvent({
      rawPath: '/users',
      rawQueryString: 'name=croco',
      requestContext: {
        ...createLambdaEvent().requestContext,
        http: {
          ...createLambdaEvent().requestContext.http,
          path: '/users',
        },
      },
    });

    await expect(handler(event, lambdaContext)).resolves.toEqual({
      statusCode: 200,
      headers: {
        'content-type': 'text/plain',
      },
      body: 'ok',
      isBase64Encoded: false,
    });
  });
});

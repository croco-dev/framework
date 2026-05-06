import { describe, expect, it } from 'vitest';
import type { LambdaEvent } from '../handler';
import { createLambdaHandler, createLambdaPreset } from '../index';

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
      fetch: async (request) => {
        expect(request.method).toBe('GET');
        expect(request.url).toBe('http://lambda.local/users?name=croco');

        return new Response('ok', {
          status: 200,
          headers: {
            'content-type': 'text/plain',
          },
        });
      },
    });
    const event: LambdaEvent = {
      httpMethod: 'GET',
      path: 'http://lambda.local/users',
      queryStringParameters: {
        name: 'croco',
      },
    };

    await expect(handler(event, {})).resolves.toEqual({
      statusCode: 200,
      headers: {
        'content-type': 'text/plain',
      },
      body: 'ok',
      isBase64Encoded: false,
    });
  });
});

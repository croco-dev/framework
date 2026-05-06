import { createWorkerFetchHandler } from '@croco/preset-cloudflare';
import type { ExecutionContext } from '@croco/preset-cloudflare/src/fetch';
import { createLambdaHandler } from '@croco/preset-lambda';
import type { LambdaEvent } from '@croco/preset-lambda/src/handler';
import { createNodeEntry } from '@croco/preset-node';
import { describe, expect, it } from 'vitest';

const createExecutionContext = (): ExecutionContext => ({
  waitUntil: () => {},
  passThroughOnException: () => {},
});

describe('E2E: Lambda preset integration', () => {
  it('handles a GET event and returns 200', async () => {
    const handler = createLambdaHandler({
      fetch: async (request) => {
        expect(request.method).toBe('GET');
        expect(request.url).toBe('http://lambda.local/api/health');
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    const event: LambdaEvent = {
      httpMethod: 'GET',
      path: 'http://lambda.local/api/health',
    };

    const response = await handler(event, {});
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ status: 'ok' }));
  });

  it('handles a POST event with body', async () => {
    const handler = createLambdaHandler({
      fetch: async (request) => {
        const body = await request.text();
        expect(body).toBe('{"name":"test"}');
        return new Response('created', { status: 201 });
      },
    });

    const event: LambdaEvent = {
      httpMethod: 'POST',
      path: 'http://lambda.local/api/data',
      body: '{"name":"test"}',
      headers: { 'content-type': 'application/json' },
    };

    const response = await handler(event, {});
    expect(response.statusCode).toBe(201);
  });

  it('handles query string parameters', async () => {
    const handler = createLambdaHandler({
      fetch: async (request) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('1');
        expect(url.searchParams.get('limit')).toBe('10');
        return new Response('ok', { status: 200 });
      },
    });

    const event: LambdaEvent = {
      httpMethod: 'GET',
      path: 'http://lambda.local/api/items',
      queryStringParameters: { page: '1', limit: '10' },
    };

    const response = await handler(event, {});
    expect(response.statusCode).toBe(200);
  });
});

describe('E2E: Cloudflare preset integration', () => {
  it('handles a fetch request and returns 200', async () => {
    const handler = createWorkerFetchHandler({
      fetch: async (request) => {
        expect(request.url).toBe('https://example.com/api/health');
        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    const request = new Request('https://example.com/api/health');
    const response = await handler(request, {}, createExecutionContext());
    expect(response.status).toBe(200);
  });
});

describe('E2E: Node preset integration', () => {
  it('starts server and makes HTTP request', async () => {
    const entry = createNodeEntry(
      {
        fetch: async (request) => {
          expect(request.method).toBe('GET');
          expect(request.url).toContain('/api/health');
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      },
      { port: 0, hostname: '127.0.0.1' }
    );

    try {
      await entry.start();
      const address = entry.server.address();
      expect(address).not.toBeNull();
      const port = typeof address === 'object' && address ? address.port : 3000;

      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ status: 'ok' });
    } finally {
      await entry.close();
    }

    expect(entry.server.listening).toBe(false);
  });
});

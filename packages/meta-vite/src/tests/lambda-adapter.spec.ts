import { describe, expect, it, vi } from 'vitest';
import { createLambdaComposedHandler, createLambdaHandler } from '../libs/providers/lambda';
import type { CrocoFetchHandler, RuntimeContext } from '../libs/render/types';

describe('lambda adapter', () => {
  it('exports the composed handler from the public module', async () => {
    const mod = await import('../index');

    expect(mod.createLambdaComposedHandler).toBeDefined();
  });

  it('converts API Gateway v2 event to Request', async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async (request) => Response.json(await request.json()));
    const handler = createLambdaHandler(pageHandler);
    const event = createHttpApiEvent({
      method: 'POST',
      rawPath: '/api/items',
      headers: {
        host: 'example.com',
        'content-type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ name: 'croco' }),
    });

    const response = await handler(event, {});
    const request = pageHandler.mock.calls[0]?.[0];

    expect(request?.method).toBe('POST');
    expect(request?.url).toBe('https://example.com/api/items');
    expect(request?.headers.get('content-type')).toBe('application/json');
    await expect(response.json()).resolves.toEqual({ name: 'croco' });
  });

  it('returns API handler response before page fallback', async () => {
    const apiHandler = {
      match: (request: Request) => new URL(request.url).pathname === '/api/hello',
      handle: vi.fn(async () => new Response('api')),
    };
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response('page'));
    const handler = createLambdaComposedHandler({ apiHandlers: [apiHandler], pageHandler });

    const response = await handler(createHttpApiEvent({ rawPath: '/api/hello' }), {});

    await expect(response.text()).resolves.toBe('api');
    expect(apiHandler.handle).toHaveBeenCalledOnce();
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it('falls back to page handler when no API handler matches', async () => {
    const apiHandler = {
      match: () => false,
      handle: vi.fn(async () => new Response('api')),
    };
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response('page'));
    const handler = createLambdaComposedHandler({ apiHandlers: [apiHandler], pageHandler });

    const response = await handler(createHttpApiEvent({ rawPath: '/products' }), {});

    await expect(response.text()).resolves.toBe('page');
    expect(apiHandler.handle).not.toHaveBeenCalled();
    expect(pageHandler).toHaveBeenCalledOnce();
  });

  it('forwards RuntimeContext to page handler', async () => {
    const event = createHttpApiEvent({ rawPath: '/products' });
    const lambdaContext = { awsRequestId: 'req-1' };
    const pageHandler = vi.fn<CrocoFetchHandler>(async (_request, _context?: RuntimeContext) => new Response('page'));
    const handler = createLambdaComposedHandler({ apiHandlers: [], pageHandler });

    await handler(event, lambdaContext);
    const context = pageHandler.mock.calls[0]?.[1];

    expect(context).toEqual({
      platform: 'lambda',
      event,
      lambdaContext,
    });
  });

  it('decodes base64 encoded body', async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async (request) => new Response(await request.text()));
    const handler = createLambdaHandler(pageHandler);
    const event = createHttpApiEvent({
      method: 'POST',
      rawPath: '/api/upload',
      body: Buffer.from('hello lambda').toString('base64'),
      isBase64Encoded: true,
    });

    const response = await handler(event, {});

    await expect(response.text()).resolves.toBe('hello lambda');
  });

  it('uses API Gateway v1 method and path as fallback', async () => {
    const pageHandler = vi.fn<CrocoFetchHandler>(async () => new Response('page'));
    const handler = createLambdaHandler(pageHandler);

    await handler(
      {
        httpMethod: 'PUT',
        path: '/v1/items',
        headers: {
          host: 'example.com',
        },
      },
      {}
    );
    const request = pageHandler.mock.calls[0]?.[0];

    expect(request?.method).toBe('PUT');
    expect(request?.url).toBe('http://example.com/v1/items');
  });
});

function createHttpApiEvent(options: {
  method?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}): Record<string, unknown> {
  return {
    version: '2.0',
    rawPath: options.rawPath ?? '/',
    rawQueryString: options.rawQueryString ?? '',
    headers: options.headers ?? { host: 'lambda.local' },
    body: options.body,
    isBase64Encoded: options.isBase64Encoded ?? false,
    requestContext: {
      http: {
        method: options.method ?? 'GET',
        path: options.rawPath ?? '/',
      },
    },
  };
}

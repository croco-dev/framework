import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMetaFetchHandler } from '../libs/render/composeHandler';
import { RenderServer } from '../libs/render/renderServer';
import { defineRoute } from '../libs/routes/defineRoute';
import { RouteRegistry } from '../libs/routes/routeRegistry';

describe('createMetaFetchHandler', () => {
  it('returns API response when the API handler handles the request', async () => {
    const handler = createMetaFetchHandler({
      apiHandler: async () => ({ handled: true, response: new Response('api-data') }),
    });

    const response = await handler(new Request('https://example.com/api/data'));

    await expect(response.text()).resolves.toBe('api-data');
  });

  it('falls back to page handler when the API handler declines the request', async () => {
    const apiHandler = vi.fn(async () => ({ handled: false as const }));
    const pageHandler = vi.fn(async () => new Response('page-fallback'));
    const handler = createMetaFetchHandler({ apiHandler, pageHandler });

    const response = await handler(new Request('https://example.com/page'));

    await expect(response.text()).resolves.toContain('page-fallback');
    expect(apiHandler).toHaveBeenCalledOnce();
    expect(pageHandler).toHaveBeenCalledOnce();
  });

  it('does not fall back to page handler for an intentional API 404', async () => {
    const pageHandler = vi.fn(async () => {
      throw new Error('page handler should not be called');
    });
    const handler = createMetaFetchHandler({
      apiHandler: async () => ({ handled: true, response: new Response('API 404', { status: 404 }) }),
      pageHandler,
    });

    const response = await handler(new Request('https://example.com/api/missing'));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('API 404');
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it('returns 404 when no page handler is available', async () => {
    const handler = createMetaFetchHandler({
      apiHandler: async () => ({ handled: false }),
    });

    const response = await handler(new Request('https://example.com/missing'));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain('Not Found');
  });

  it('delegates directly to page handler when no API handler is provided', async () => {
    const handler = createMetaFetchHandler({
      pageHandler: async () => new Response('page-direct'),
    });

    const response = await handler(new Request('https://example.com/page'));

    await expect(response.text()).resolves.toContain('page-direct');
  });

  it('supports RenderServer as the page handler', async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: '/registry-page',
        component: () => createElement('main', null, 'Rendered through registry'),
        mode: 'ssr',
      })
    );
    const handler = createMetaFetchHandler({ pageHandler: new RenderServer(registry.compile()) });

    const response = await handler(new Request('https://example.com/registry-page'));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Rendered through registry');
  });

  it('falls back to page handler when the API handler throws', async () => {
    const handler = createMetaFetchHandler({
      apiHandler: async () => {
        throw new Error('api failed');
      },
      pageHandler: async () => new Response('fallback-after-error'),
    });

    const response = await handler(new Request('https://example.com/page'));

    await expect(response.text()).resolves.toBe('fallback-after-error');
  });
});

import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { RenderServer } from '../libs/render/renderServer';
import type { CrocoApiHandlerResult } from '../libs/render/types';
import { defineRoute } from '../libs/routes/defineRoute';
import { RouteRegistry } from '../libs/routes/routeRegistry';
import type { RenderRouteComponentProps, RenderRouteIR } from '../libs/routes/types';

function createRoute(path: string, component: React.ComponentType<RenderRouteComponentProps>): RenderRouteIR {
  return {
    path,
    mode: 'ssr',
    componentLoader: async () => ({ default: component }),
  };
}

async function runApiFirst(result: CrocoApiHandlerResult, server: RenderServer, request: Request): Promise<Response> {
  if (result.handled) {
    return result.response;
  }

  return server.handle(request);
}

describe('RenderServer', () => {
  it('returns rendered HTML for a matched route', async () => {
    const server = new RenderServer([createRoute('/hello', () => createElement('main', null, 'Hello from SSR'))]);

    const response = await server.handle(new Request('https://example.com/hello'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain('Hello from SSR');
  });

  it('returns static 404 HTML for an unmatched route', async () => {
    const server = new RenderServer([createRoute('/hello', () => createElement('main', null, 'Hello'))]);

    const response = await server.handle(new Request('https://example.com/missing'));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain('Not Found');
  });

  it('returns static 500 HTML when component rendering fails', async () => {
    const server = new RenderServer([
      createRoute('/broken', () => {
        throw new Error('render failed');
      }),
    ]);

    const response = await server.handle(new Request('https://example.com/broken'));

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain('Internal Server Error');
  });

  it('returns the API response when the API handler claims the request', async () => {
    const server = new RenderServer([createRoute('/api/users', () => createElement('main', null, 'Page fallback'))]);
    const apiResult: CrocoApiHandlerResult = {
      handled: true,
      response: new Response('API response', { status: 404 }),
    };

    const response = await runApiFirst(apiResult, server, new Request('https://example.com/api/users'));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('API response');
  });

  it('falls back to page rendering when the API handler declines the request', async () => {
    const server = new RenderServer([createRoute('/page', () => createElement('main', null, 'Page response'))]);
    const apiResult: CrocoApiHandlerResult = { handled: false };

    const response = await runApiFirst(apiResult, server, new Request('https://example.com/page'));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Page response');
  });

  it('injects route head() title into the HTML shell', async () => {
    const server = new RenderServer([
      {
        path: '/with-head',
        mode: 'ssr',
        componentLoader: async () => ({ default: () => createElement('main', null, 'Head test page') }),
        head: () => ({ title: 'Custom Page Title', description: 'Custom description text' }),
      },
    ]);

    const response = await server.handle(new Request('https://example.com/with-head'));

    const text = await response.text();
    expect(text).toContain('<title>Custom Page Title</title>');
    expect(text).toContain('<meta name="description" content="Custom description text">');
    expect(text).toContain('<!DOCTYPE html>');
    expect(text).toContain('<div id="root">');
  });

  it('injects route head() canonical link when present', async () => {
    const server = new RenderServer([
      {
        path: '/canonical',
        mode: 'ssr',
        componentLoader: async () => ({ default: () => createElement('main', null, 'Canonical test') }),
        head: () => ({ canonical: 'https://example.com/og-page' }),
      },
    ]);

    const response = await server.handle(new Request('https://example.com/canonical'));

    const text = await response.text();
    expect(text).toContain('<link rel="canonical" href="https://example.com/og-page">');
  });

  it('escapes HTML in head title and description', async () => {
    const server = new RenderServer([
      {
        path: '/xss',
        mode: 'ssr',
        componentLoader: async () => ({ default: () => createElement('main', null, 'XSS test') }),
        head: () => ({ title: '<script>alert("xss")</script>', description: 'Description with "quotes" & stuff' }),
      },
    ]);

    const response = await server.handle(new Request('https://example.com/xss'));

    const text = await response.text();
    expect(text).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(text).toContain('Description with &quot;quotes&quot; &amp; stuff');
    expect(text).not.toContain('<script>alert');
  });

  it('returns static 404 HTML with safe fallback head title', async () => {
    const server = new RenderServer([]);

    const response = await server.handle(new Request('https://example.com/anything'));

    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).toContain('<title>Not Found</title>');
    expect(text).toContain('<meta name="description" content="The requested page was not found">');
    expect(text).toContain('<h1>Not Found</h1>');
  });

  it('returns static 500 HTML with safe fallback head title', async () => {
    const server = new RenderServer([
      {
        path: '/crash',
        mode: 'ssr',
        componentLoader: async () => ({
          default: () => {
            throw new Error('boom');
          },
        }),
      },
    ]);

    const response = await server.handle(new Request('https://example.com/crash'));

    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain('<title>Internal Server Error</title>');
    expect(text).toContain('<meta name="description" content="An unexpected error occurred">');
    expect(text).toContain('<h1>Internal Server Error</h1>');
  });

  it('uses "Croco App" as default title when route has no head()', async () => {
    const server = new RenderServer([createRoute('/no-head', () => createElement('main', null, 'No head'))]);

    const response = await server.handle(new Request('https://example.com/no-head'));

    const text = await response.text();
    expect(text).toContain('<title>Croco App</title>');
  });

  it('passes RuntimeContext platform through to the component', async () => {
    const RuntimeAwareComponent = ({ context }: RenderRouteComponentProps) => {
      return createElement('main', null, `Platform: ${context?.platform ?? 'missing'}`);
    };
    const server = new RenderServer([createRoute('/runtime', RuntimeAwareComponent)]);

    const response = await server.handle(new Request('https://example.com/runtime'), { platform: 'cloudflare' });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('Platform: cloudflare');
  });

  it('renders a compiled RouteRegistry SSR route with head metadata', async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: '/registry-page',
        component: ({ request }) => createElement('main', null, `Registry SSR: ${new URL(request.url).pathname}`),
        mode: 'ssr',
        head: () => ({ title: 'Registry Page', description: 'Compiled route metadata' }),
      })
    );
    const server = new RenderServer(registry.compile());

    const response = await server.handle(new Request('https://example.com/registry-page'));

    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain('Registry SSR: /registry-page');
    expect(text).toContain('<title>Registry Page</title>');
    expect(text).toContain('<meta name="description" content="Compiled route metadata">');
  });

  it('returns safe 500 HTML for a compiled RouteRegistry render failure', async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: '/registry-error',
        component: () => {
          throw new Error('registry render failed');
        },
      })
    );
    const server = new RenderServer(registry.compile());

    const response = await server.handle(new Request('https://example.com/registry-error'));

    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain('<title>Internal Server Error</title>');
    expect(text).toContain('<meta name="description" content="An unexpected error occurred">');
    expect(text).toContain('<h1>Internal Server Error</h1>');
    expect(text).not.toContain('registry render failed');
  });

  it('returns safe 404 HTML when compiled RouteRegistry routes do not match', async () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/registered', component: () => createElement('main', null, 'Registered') }));
    const server = new RenderServer(registry.compile());

    const response = await server.handle(new Request('https://example.com/unregistered'));

    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).toContain('<title>Not Found</title>');
    expect(text).toContain('<meta name="description" content="The requested page was not found">');
    expect(text).toContain('<h1>Not Found</h1>');
    expect(text).not.toContain('Registered');
  });
});

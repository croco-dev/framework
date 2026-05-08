import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { defineRoute } from '../libs/routes/defineRoute';
import { head } from '../libs/routes/head';
import { RouteRegistry } from '../libs/routes/routeRegistry';
import type { RenderRouteComponentProps } from '../libs/routes/types';

function Page({ request }: RenderRouteComponentProps) {
  return createElement('main', null, request.url);
}

describe('RouteRegistry', () => {
  it('compiles an SSR route', async () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/dashboard', component: Page, mode: 'ssr' }));

    const routes = registry.compile();

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ path: '/dashboard', mode: 'ssr' });
    await expect(routes[0]?.componentLoader()).resolves.toEqual({ default: Page });
  });

  it('compiles an SSG route', () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/about', component: Page, mode: 'ssg' }));

    const routes = registry.compile();

    expect(routes[0]).toMatchObject({ path: '/about', mode: 'ssg' });
  });

  it('compiles an ISR route with revalidation in milliseconds', () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/blog', component: Page, mode: 'isr', revalidate: 60 }));

    const routes = registry.compile();

    expect(routes[0]).toMatchObject({ path: '/blog', mode: 'isr', revalidateMs: 60_000 });
  });

  it('compiles an RSC route', () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/feed', component: Page, mode: 'rsc' }));

    const routes = registry.compile();

    expect(routes[0]).toMatchObject({ path: '/feed', mode: 'rsc' });
  });

  it('keeps registered route order', () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/first', component: Page, mode: 'ssr' }));
    registry.register(defineRoute({ path: '/second', component: Page, mode: 'ssg' }));
    registry.register(defineRoute({ path: '/third', component: Page, mode: 'rsc' }));

    const routes = registry.compile();

    expect(routes.map((route) => route.path)).toEqual(['/first', '/second', '/third']);
  });

  it('loads components typed with RenderRouteComponentProps', async () => {
    const registry = new RouteRegistry();
    registry.register(defineRoute({ path: '/typed', component: Page }));

    const [route] = registry.compile();
    const module = await route.componentLoader();
    const element = createElement(module.default, { request: new Request('https://example.com/typed') });

    expect(element.type).toBe(Page);
  });
});

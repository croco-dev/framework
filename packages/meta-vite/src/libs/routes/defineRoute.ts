import type { PageRouteDefinition } from './types';

/**
 * Register a flat code-based page route.
 * Identity function — returns the same definition for build plugin consumption.
 *
 * Usage:
 * ```ts
 * const routes = [
 *   defineRoute({ path: '/', component: HomePage, mode: 'ssr' }),
 *   defineRoute({ path: '/about', component: AboutPage, mode: 'ssg' }),
 * ];
 * ```
 */
export function defineRoute(route: PageRouteDefinition): PageRouteDefinition {
  return route;
}

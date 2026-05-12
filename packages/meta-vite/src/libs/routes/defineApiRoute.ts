import type { ApiRouteDefinition } from "./types";

/**
 * Register a flat code-based API route.
 * Identity function — returns the same definition for build plugin consumption.
 *
 * Usage:
 * ```ts
 * const apiRoutes = [
 *   defineApiRoute({ path: '/api/users', method: 'GET', handler: getUsers }),
 *   defineApiRoute({ path: '/api/users', method: 'POST', handler: createUser }),
 * ];
 * ```
 */
export function defineApiRoute(route: ApiRouteDefinition): ApiRouteDefinition {
  return route;
}

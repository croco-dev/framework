import type { ApiRouteDefinition } from "./types";

class ApiRoutePrefixError extends Error {
  readonly code = "CROCO_META_VITE_API_ROUTE_PREFIX_REQUIRED";

  constructor(
    readonly path: string,
    readonly method: string,
  ) {
    super(`API route '${method} ${path}' requires path '/api' or a path under '/api/'`);
    this.name = "ApiRoutePrefixError";
  }
}

export function validateApiRoute(route: Pick<ApiRouteDefinition, "path" | "method">): void {
  if (route.path !== "/api" && !route.path.startsWith("/api/")) {
    throw new ApiRoutePrefixError(route.path, route.method ?? "GET");
  }
}

import { Problem, ProblemCategory } from "@croco/problems-core";

import type { ApiRouteDefinition } from "./types";

class ApiRoutePrefixProblem extends Problem {
  readonly code = "CROCO_META_VITE_API_ROUTE_PREFIX_REQUIRED";
  readonly category = ProblemCategory.BadRequest;

  constructor(
    readonly path: string,
    readonly method: string,
  ) {
    super(
      "CROCO_META_VITE_API_ROUTE_PREFIX_REQUIRED",
      ProblemCategory.BadRequest,
      `API route '${method} ${path}' requires path '/api' or a path under '/api/'`,
      { extensions: { path, method } },
    );
  }
}

export function validateApiRoute(route: Pick<ApiRouteDefinition, "path" | "method">): void {
  if (route.path !== "/api" && !route.path.startsWith("/api/")) {
    throw new ApiRoutePrefixProblem(route.path, route.method ?? "GET");
  }
}

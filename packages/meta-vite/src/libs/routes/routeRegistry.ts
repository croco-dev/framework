import { validateApiRoute } from "./validateApiRoute";

import type {
  ApiRouteDefinition,
  ApiRouteIR,
  PageRouteDefinition,
  PageRouteIR,
  RenderMode,
  RenderRouteIR,
} from "./types";

export class RouteConflictError extends Error {
  constructor(path: string, method?: string) {
    const label = method
      ? `API route conflict: '${method} ${path}'`
      : `Page route conflict: '${path}'`;
    super(`${label} is already registered`);
    this.name = "RouteConflictError";
  }
}

export class ShellRouteDefinitionError extends Error {
  readonly code = "meta-vite/shell-route-ssr-only" as const;

  constructor(path: string, mode: string) {
    super(
      `Shell-first streaming (resolveShell/regions/stream) requires mode 'ssr': '${path}' declares mode '${mode}'`,
    );
    this.name = "ShellRouteDefinitionError";
  }
}

export class RouteRegistry {
  private readonly definitions: PageRouteDefinition[] = [];
  private readonly apiDefinitions: ApiRouteIR[] = [];

  register(definition: PageRouteDefinition): void {
    if (this.hasRegisteredRoute(definition.path)) {
      throw new RouteConflictError(definition.path);
    }
    if (definition.mode !== undefined && definition.mode !== "ssr") {
      if (definition.resolveShell ?? definition.regions ?? definition.stream) {
        throw new ShellRouteDefinitionError(definition.path, definition.mode);
      }
    }
    this.definitions.push(definition);
  }

  compile(): RenderRouteIR[] {
    return this.definitions.map((definition) => this.compileDefinition(definition));
  }

  getPageRoutes(): PageRouteIR[] {
    return this.definitions.map((definition) => this.toPageRouteIR(definition));
  }

  private compileDefinition(definition: PageRouteDefinition): RenderRouteIR {
    const pageRoute = this.toPageRouteIR(definition);

    return {
      path: pageRoute.path,
      mode: pageRoute.mode,
      componentLoader: async () => ({ default: definition.component }),
      ...(pageRoute.head ? { head: pageRoute.head } : {}),
      ...(pageRoute.revalidateMs !== undefined ? { revalidateMs: pageRoute.revalidateMs } : {}),
      ...(pageRoute.resolveShell ? { resolveShell: pageRoute.resolveShell } : {}),
      ...(pageRoute.regions ? { regions: pageRoute.regions } : {}),
      ...(pageRoute.stream ? { stream: pageRoute.stream } : {}),
    };
  }

  private toPageRouteIR(definition: PageRouteDefinition): PageRouteIR {
    return {
      path: definition.path,
      mode: this.resolveMode(definition.mode),
      ...(definition.componentRef ? { componentRef: definition.componentRef } : {}),
      ...(definition.head ? { head: definition.head } : {}),
      ...(definition.revalidate !== undefined
        ? { revalidateMs: definition.revalidate * 1000 }
        : {}),
      ...(definition.resolveShell ? { resolveShell: definition.resolveShell } : {}),
      ...(definition.regions ? { regions: definition.regions } : {}),
      ...(definition.stream ? { stream: definition.stream } : {}),
    };
  }

  private resolveMode(mode?: RenderMode): RenderMode {
    return mode ?? "ssr";
  }

  registerApiRoute(definition: ApiRouteDefinition): void {
    validateApiRoute(definition);
    const method = definition.method ?? "GET";
    if (this.hasRegisteredRoute(definition.path, method)) {
      throw new RouteConflictError(definition.path, method);
    }
    this.apiDefinitions.push({ path: definition.path, method, handler: definition.handler });
  }

  getApiRoutes(): ApiRouteIR[] {
    return [...this.apiDefinitions];
  }

  private hasRegisteredRoute(path: string, method?: string): boolean {
    if (method === undefined) {
      return this.definitions.some((route) => route.path === path);
    }

    return this.apiDefinitions.some((route) => route.path === path && route.method === method);
  }
}

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

export class RouteRegistry {
  private readonly definitions: PageRouteDefinition[] = [];
  private readonly apiDefinitions: ApiRouteIR[] = [];

  register(definition: PageRouteDefinition): void {
    if (this.hasRegisteredRoute(definition.path)) {
      throw new RouteConflictError(definition.path);
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
    };
  }

  private resolveMode(mode?: RenderMode): RenderMode {
    return mode ?? "ssr";
  }

  registerApiRoute(definition: ApiRouteDefinition): void {
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

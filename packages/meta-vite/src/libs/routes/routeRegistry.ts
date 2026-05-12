import type {
  ApiRouteDefinition,
  ApiRouteIR,
  PageRouteDefinition,
  PageRouteIR,
  RenderMode,
  RenderRouteIR,
} from "./types";

export class RouteConflictError extends Error {
  constructor(path: string, method: string) {
    super(`API route conflict: '${method} ${path}' is already registered`);
    this.name = "RouteConflictError";
  }
}

export class RouteRegistry {
  private readonly definitions: PageRouteDefinition[] = [];
  private readonly apiDefinitions: ApiRouteIR[] = [];

  register(definition: PageRouteDefinition): void {
    this.definitions.push(definition);
  }

  compile(): RenderRouteIR[] {
    return this.definitions.map((definition) => this.compileDefinition(definition));
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
      componentRef: definition.path,
      mode: this.resolveMode(definition.mode),
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
    const conflict = this.apiDefinitions.some(
      (r) => r.path === definition.path && (r.method ?? "GET") === method,
    );
    if (conflict) {
      throw new RouteConflictError(definition.path, method);
    }
    this.apiDefinitions.push({ path: definition.path, method, handler: definition.handler });
  }

  getApiRoutes(): ApiRouteIR[] {
    return [...this.apiDefinitions];
  }
}

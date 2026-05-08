import type { PageRouteDefinition, PageRouteIR, RenderMode, RenderRouteIR } from './types';

export class RouteRegistry {
  private readonly definitions: PageRouteDefinition[] = [];

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
      ...(definition.revalidate !== undefined ? { revalidateMs: definition.revalidate * 1000 } : {}),
    };
  }

  private resolveMode(mode?: RenderMode): RenderMode {
    return mode ?? 'ssr';
  }
}

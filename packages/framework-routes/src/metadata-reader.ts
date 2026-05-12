import "reflect-metadata";

export type CompiledRouteInfo = {
  readonly method: string;
  readonly path: string;
  readonly handlerName: string;
};

export type CompiledControllerInfo = {
  readonly basePath: string;
  readonly className: string;
  readonly routes: readonly CompiledRouteInfo[];
};

type ControllerMetadataShape = {
  readonly path: string;
};

type RouteMetadataShape = {
  readonly method: string;
  readonly path: string;
  readonly methodName: string | symbol;
};

const CONTROLLER_KEY = Symbol.for("croco:rest:controller");
const ROUTES_KEY = Symbol.for("croco:rest:routes");

export async function readControllerMetadata(
  controllerPath: string,
): Promise<CompiledControllerInfo | null> {
  const mod = await import(controllerPath);

  for (const [className, exported] of Object.entries(mod)) {
    if (typeof exported !== "function") {
      continue;
    }

    const controllerMeta = Reflect.getMetadata(CONTROLLER_KEY, exported) as
      | ControllerMetadataShape
      | undefined;
    const routesMeta = Reflect.getMetadata(ROUTES_KEY, exported) as
      | RouteMetadataShape[]
      | undefined;

    if (!controllerMeta || !routesMeta) {
      continue;
    }

    return {
      basePath: controllerMeta.path,
      className,
      routes: routesMeta.map((route) => ({
        method: route.method,
        path: route.path,
        handlerName: String(route.methodName),
      })),
    };
  }

  return null;
}

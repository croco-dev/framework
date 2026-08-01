import "reflect-metadata";
import { discoverControllerConstructors, type Constructor } from "@croco/protocols-core";

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

export type ControllerModule = {
  readonly constructors: readonly Constructor[];
  readonly exportNames: ReadonlyMap<Constructor, string>;
};

export async function readControllerModule(controllerPath: string): Promise<ControllerModule> {
  const mod = (await import(controllerPath)) as Record<string, unknown>;
  const constructors = discoverControllerConstructors(mod);
  const exportNames = new Map<Constructor, string>();

  for (const controller of constructors) {
    const exportName = Object.entries(mod).find(([, value]) => value === controller)?.[0];

    if (exportName !== undefined) {
      exportNames.set(controller, exportName);
    }
  }

  return { constructors, exportNames };
}

export async function readControllerConstructors(
  controllerPath: string,
): Promise<readonly Constructor[]> {
  return (await readControllerModule(controllerPath)).constructors;
}

export async function readControllersMetadata(
  controllerPath: string,
): Promise<readonly CompiledControllerInfo[]> {
  return readControllersMetadataFromConstructors(await readControllerConstructors(controllerPath));
}

export async function readControllerMetadata(
  controllerPath: string,
): Promise<CompiledControllerInfo | null> {
  const [controller] = await readControllersMetadata(controllerPath);

  return controller ?? null;
}

export function readControllersMetadataFromConstructors(
  controllerConstructors: readonly Constructor[],
): CompiledControllerInfo[] {
  const controllers: CompiledControllerInfo[] = [];

  for (const controller of controllerConstructors) {
    const controllerMeta = Reflect.getMetadata(CONTROLLER_KEY, controller) as
      | ControllerMetadataShape
      | undefined;
    const routesMeta = Reflect.getMetadata(ROUTES_KEY, controller) as
      | RouteMetadataShape[]
      | undefined;

    if (!controllerMeta || !routesMeta) {
      continue;
    }

    controllers.push({
      basePath: controllerMeta.path,
      className: controller.name,
      routes: routesMeta.map((route) => ({
        method: route.method,
        path: route.path,
        handlerName: String(route.methodName),
      })),
    });
  }

  return controllers;
}

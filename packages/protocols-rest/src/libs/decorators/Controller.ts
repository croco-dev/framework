import "reflect-metadata";
import { REST_CONTROLLER_KEY, REST_ROUTES_KEY } from "../constants";
import type { ControllerMetadata, RouteMetadata } from "../types";

/**
 * 클래스를 REST 컨트롤러로 등록하고 기본 경로를 저장합니다.
 */
export function Controller(path: string = ""): ClassDecorator {
  return (target: Function) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const metadata: ControllerMetadata = {
      path: normalizedPath === "/" ? "" : normalizedPath,
      target,
    };
    Reflect.defineMetadata(REST_CONTROLLER_KEY, metadata, target);
    normalizeContractRoutePaths(target, metadata.path);
  };
}

function normalizeContractRoutePaths(target: Function, controllerPath: string): void {
  const routes = Reflect.getOwnMetadata(REST_ROUTES_KEY, target) as RouteMetadata[] | undefined;

  if (!routes?.some((route) => route.contract)) {
    return;
  }

  Reflect.defineMetadata(
    REST_ROUTES_KEY,
    routes.map((route) =>
      route.contract
        ? {
            ...route,
            path: toControllerRelativePath(controllerPath, route.contract.path),
          }
        : route,
    ),
    target,
  );
}

function toControllerRelativePath(controllerPath: string, routePath: string): string {
  const normalizedRoutePath = routePath.startsWith("/") ? routePath : `/${routePath}`;

  if (controllerPath === "") {
    return normalizedRoutePath === "/" ? "" : normalizedRoutePath;
  }

  if (normalizedRoutePath === controllerPath) {
    return "";
  }

  if (normalizedRoutePath.startsWith(`${controllerPath}/`)) {
    return normalizedRoutePath.slice(controllerPath.length);
  }

  return normalizedRoutePath;
}

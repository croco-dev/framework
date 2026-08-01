import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { REST_CONTROLLER_KEY, REST_ROUTES_KEY } from "../constants";
import { captureRestDecoratorSourceLocation } from "../sourceLocation";
import type { Constructor } from "@croco/framework-context";
import type { ControllerMetadata, RouteMetadata } from "../types";

/**
 * 클래스를 REST 컨트롤러로 등록하고 기본 경로를 저장합니다.
 */
export function Controller(path: string = ""): ClassDecorator {
  return (target: Function) => {
    const controller = target as Constructor;
    const sourceLocation = captureRestDecoratorSourceLocation();
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const metadata: ControllerMetadata = {
      path: normalizedPath === "/" ? "" : normalizedPath,
      target,
      ...(sourceLocation ? { sourceLocation } : {}),
    };
    Reflect.defineMetadata(REST_CONTROLLER_KEY, metadata, target);
    normalizeContractRoutePaths(target, metadata.path);

    if (Container.getComponentMetadata(controller) === undefined) {
      Container.register(controller, "singleton");
    }
    if (sourceLocation) {
      Container.setComponentSourceLocation(controller, {
        file: sourceLocation.path,
        ...(sourceLocation.line === undefined ? {} : { line: sourceLocation.line }),
        ...(sourceLocation.column === undefined ? {} : { column: sourceLocation.column }),
      });
    }
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

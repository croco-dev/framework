import "reflect-metadata";
import { REST_CONTROLLER_KEY } from "../constants";
import type { ControllerMetadata } from "../types";

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
  };
}

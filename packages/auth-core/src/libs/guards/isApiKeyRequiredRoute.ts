import "reflect-metadata";
import { API_KEY_REQUIRED_KEY } from "../constants";

export function isApiKeyRequiredRoute(controllerTarget: object, handler: string | symbol): boolean {
  const classTarget =
    typeof controllerTarget === "function" ? controllerTarget : controllerTarget.constructor;
  const prototypeTarget =
    typeof controllerTarget === "function" ? controllerTarget.prototype : controllerTarget;
  const methodTarget = Reflect.get(prototypeTarget, handler) as unknown;

  return Boolean(
    Reflect.getMetadata(API_KEY_REQUIRED_KEY, classTarget, handler) ??
    Reflect.getMetadata(API_KEY_REQUIRED_KEY, prototypeTarget, handler) ??
    (typeof methodTarget === "function"
      ? Reflect.getMetadata(API_KEY_REQUIRED_KEY, methodTarget)
      : undefined) ??
    Reflect.getMetadata(API_KEY_REQUIRED_KEY, classTarget) ??
    Reflect.getMetadata(API_KEY_REQUIRED_KEY, prototypeTarget),
  );
}

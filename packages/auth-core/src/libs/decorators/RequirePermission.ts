import "reflect-metadata";
import { AUTH_PERMISSIONS_KEY } from "../constants";

const DECLARED_PERMISSIONS_KEY = Symbol.for("croco:auth:declared-permissions");

export function RequirePermission(...permissions: string[]): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const previous = Reflect.getOwnMetadata(DECLARED_PERMISSIONS_KEY, target, propertyKey) as
      | string[]
      | undefined;
    const required = previous ? [...new Set([...permissions, ...previous])] : permissions;
    Reflect.defineMetadata(DECLARED_PERMISSIONS_KEY, required, target, propertyKey);
    Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, required, target.constructor, propertyKey);
    return descriptor;
  };
}

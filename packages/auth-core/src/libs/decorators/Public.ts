import "reflect-metadata";
import { AUTH_PUBLIC_KEY } from "../constants";

export function Public(): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, target, propertyKey);
    Reflect.defineMetadata(AUTH_PUBLIC_KEY, true, target.constructor, propertyKey);
    return descriptor;
  };
}

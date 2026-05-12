import "reflect-metadata";
import { ACCESS_METADATA_KEY } from "../constants";

export function Access(objectType: string, relation: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(
      ACCESS_METADATA_KEY,
      { objectType, relation },
      target.constructor,
      propertyKey,
    );
    return descriptor;
  };
}

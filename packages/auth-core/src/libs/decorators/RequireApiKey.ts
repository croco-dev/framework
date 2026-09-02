import "reflect-metadata";
import { API_KEY_REQUIRED_KEY } from "../constants";

export function RequireApiKey(): MethodDecorator & ClassDecorator {
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor && propertyKey !== undefined) {
      Reflect.defineMetadata(API_KEY_REQUIRED_KEY, true, target, propertyKey);
      Reflect.defineMetadata(API_KEY_REQUIRED_KEY, true, target.constructor, propertyKey);
      Reflect.defineMetadata(API_KEY_REQUIRED_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(API_KEY_REQUIRED_KEY, true, target);
    }
  };
}

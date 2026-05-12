import "reflect-metadata";
import { API_KEY_REQUIRED_KEY } from "../constants";

export function RequireApiKey(): MethodDecorator & ClassDecorator {
  return (target: object, _propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(API_KEY_REQUIRED_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(API_KEY_REQUIRED_KEY, true, target);
    }
  };
}

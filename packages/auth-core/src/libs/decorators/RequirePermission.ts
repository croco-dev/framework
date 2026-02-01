import 'reflect-metadata';
import { AUTH_PERMISSIONS_KEY } from '../constants';

export function RequirePermission(...permissions: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    Reflect.defineMetadata(AUTH_PERMISSIONS_KEY, permissions, target.constructor, propertyKey);
    return descriptor;
  };
}

import 'reflect-metadata';
import { REST_ROLES_KEY } from '../constants';

export function Roles(...roles: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(REST_ROLES_KEY, roles, target.constructor, propertyKey);
    return descriptor;
  };
}

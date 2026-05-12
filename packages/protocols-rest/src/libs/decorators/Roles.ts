import "reflect-metadata";
import { REST_ROLES_KEY } from "../constants";

/**
 * 메서드에 필요한 역할 이름 목록을 등록합니다.
 */
export function Roles(...roles: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(REST_ROLES_KEY, roles, target.constructor, propertyKey);
    return descriptor;
  };
}

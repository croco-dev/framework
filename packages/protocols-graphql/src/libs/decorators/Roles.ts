import "reflect-metadata";
import { GRAPHQL_ROLES_KEY } from "../constants";

/**
 * Associates required roles with a GraphQL resolver method.
 */
export function Roles(...roles: string[]): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(GRAPHQL_ROLES_KEY, roles, target, propertyKey);
    return descriptor;
  };
}

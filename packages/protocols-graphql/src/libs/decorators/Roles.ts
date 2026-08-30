import "reflect-metadata";
import { GRAPHQL_ROLES_KEY } from "../constants";
import { defineGraphQLMethodMetadata } from "../metadata/GraphQLMetadata";

/**
 * Associates required roles with a GraphQL resolver method.
 */
export function Roles(...roles: string[]): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    defineGraphQLMethodMetadata(GRAPHQL_ROLES_KEY, target, propertyKey, roles);
    return descriptor;
  };
}

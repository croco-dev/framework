import "reflect-metadata";
import { GRAPHQL_GUARDS_KEY, GRAPHQL_INTERCEPTORS_KEY } from "../constants";
import {
  appendGraphQLMethodMetadata,
  appendGraphQLMethodOwnMetadata,
} from "../metadata/GraphQLMetadata";
import type { ClassType, GraphQLGuard, GraphQLInterceptor } from "../types";

/**
 * Associates Croco guards with a GraphQL resolver method.
 *
 * Inherited guards execute before guards declared on the overriding method.
 */
export function UseGuards(...guards: ClassType<GraphQLGuard>[]): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    appendGraphQLMethodMetadata(GRAPHQL_GUARDS_KEY, target, propertyKey, guards);
    return descriptor;
  };
}

/**
 * Associates Croco interceptors with a GraphQL resolver method.
 *
 * Interceptors execute in declaration order with standard onion semantics.
 */
export function UseInterceptors(...interceptors: ClassType<GraphQLInterceptor>[]): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    appendGraphQLMethodOwnMetadata(GRAPHQL_INTERCEPTORS_KEY, target, propertyKey, interceptors);
    return descriptor;
  };
}

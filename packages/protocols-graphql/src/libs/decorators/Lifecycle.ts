import "reflect-metadata";
import { GRAPHQL_GUARDS_KEY, GRAPHQL_INTERCEPTORS_KEY } from "../constants";
import type { ClassType, GraphQLGuard, GraphQLInterceptor } from "../types";

/**
 * Associates Croco guards with a GraphQL resolver method.
 *
 * Guards execute in declaration order before the resolver method runs.
 */
export function UseGuards(...guards: ClassType<GraphQLGuard>[]): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    Reflect.defineMetadata(GRAPHQL_GUARDS_KEY, guards, target, propertyKey);
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
    Reflect.defineMetadata(GRAPHQL_INTERCEPTORS_KEY, interceptors, target, propertyKey);
    return descriptor;
  };
}

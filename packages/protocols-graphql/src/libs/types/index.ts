import type { Scope } from "@croco/framework-context";

export type { ClassType, MiddlewareFn, ResolverData } from "type-graphql";

export type GraphQLContext = {
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
};

export type ResolverMetadata = {
  target: object;
  methodName: string;
  type: "query" | "mutation" | "field";
  returnType?: unknown;
  args?: Record<string, unknown>;
};

export type GraphQLResolverMetadata = {
  scope?: Scope;
  target: object;
};

export type { GraphQLGuard, GraphQLGuardContext } from "./GuardTypes";
export type {
  GraphQLCallHandler,
  GraphQLInterceptor,
  GraphQLInterceptorContext,
} from "./InterceptorTypes";
export type { GuardedResolver, ResolverFactory, TypedResolver } from "./ResolverTypes";

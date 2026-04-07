import type { ResolverData } from 'type-graphql';

export type GraphQLInterceptorContext = ResolverData<Record<string, unknown>>;

export interface GraphQLCallHandler<T = unknown> {
  handle(): Promise<T>;
}

export interface GraphQLInterceptor {
  intercept(context: GraphQLInterceptorContext, next: GraphQLCallHandler): Promise<unknown>;
}

export type {
  ClassType,
  MiddlewareFn,
  ResolverData,
} from 'type-graphql';

export type GraphQLContext = {
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
};

export type ResolverMetadata = {
  target: object;
  methodName: string;
  type: 'query' | 'mutation' | 'field';
  returnType?: unknown;
  args?: Record<string, unknown>;
};

export type GraphQLResolverMetadata = {
  target: object;
};

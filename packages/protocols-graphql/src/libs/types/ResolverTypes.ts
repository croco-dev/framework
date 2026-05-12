import type { ResolverData } from "type-graphql";

export type TypedResolver<
  TSource = unknown,
  TContext extends Record<string, unknown> = Record<string, unknown>,
  TArgs = Record<string, unknown>,
  TReturn = unknown,
> = (source: TSource, args: TArgs, context: TContext, info: unknown) => Promise<TReturn> | TReturn;

export type ResolverFactory<
  TSource = unknown,
  TContext extends Record<string, unknown> = Record<string, unknown>,
  TArgs = Record<string, unknown>,
  TReturn = unknown,
> = (data: ResolverData<TContext>) => TypedResolver<TSource, TContext, TArgs, TReturn>;

export type GuardedResolver<
  TSource = unknown,
  TContext extends Record<string, unknown> = Record<string, unknown>,
  TArgs = Record<string, unknown>,
  TReturn = unknown,
> = {
  resolver: TypedResolver<TSource, TContext, TArgs, TReturn>;
  guards: Array<new () => import("./GuardTypes").GraphQLGuard>;
};

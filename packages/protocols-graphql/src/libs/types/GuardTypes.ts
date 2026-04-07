import type { Guard } from '@croco/framework-context';
import type { ResolverData } from 'type-graphql';

export type GraphQLGuardContext = ResolverData<Record<string, unknown>>;

export type GraphQLGuard = Guard<GraphQLGuardContext>;

import 'reflect-metadata';
import { RESOLVER_KEY, RESOLVERS_KEY } from '../constants';
import type { GraphQLResolverMetadata } from '../types';

export function isResolver(target: Function): boolean {
  return !!Reflect.getMetadata(RESOLVER_KEY, target);
}

export function getResolverMetadata(target: Function): GraphQLResolverMetadata | undefined {
  return Reflect.getMetadata(RESOLVER_KEY, target);
}

export function getAllResolvers(): Function[] {
  return Reflect.getMetadata(RESOLVERS_KEY, Reflect) || [];
}

import 'reflect-metadata';
import { RESOLVER_KEY } from '../constants';
import type { GraphQLResolverMetadata } from '../types';
import { resolverRegistry } from './ResolverRegistry';

export function isResolver(target: Function): boolean {
  return !!Reflect.getMetadata(RESOLVER_KEY, target);
}

export function getResolverMetadata(target: Function): GraphQLResolverMetadata | undefined {
  return Reflect.getMetadata(RESOLVER_KEY, target);
}

export function getAllResolvers(): Function[] {
  return resolverRegistry.getAll();
}

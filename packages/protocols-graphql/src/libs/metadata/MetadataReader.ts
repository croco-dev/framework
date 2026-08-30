import "reflect-metadata";
import { RESOLVER_KEY } from "../constants";
import type { GraphQLResolverMetadata } from "../types";
import { getGraphQLClassMetadata } from "./GraphQLMetadata";
import { ResolverRegistry, resolverRegistry } from "./ResolverRegistry";

export function isResolver(target: Function): boolean {
  return getGraphQLClassMetadata(RESOLVER_KEY, target) !== undefined;
}

export function getResolverMetadata(target: Function): GraphQLResolverMetadata | undefined {
  return getGraphQLClassMetadata(RESOLVER_KEY, target);
}

export function getAllResolvers(): Function[] {
  return ResolverRegistry.fromMetadata().getAll();
}

export function getAllResolversFromRegistry(
  registry: ResolverRegistry = resolverRegistry,
): Function[] {
  return registry.getAll();
}

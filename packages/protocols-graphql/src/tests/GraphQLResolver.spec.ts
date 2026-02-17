import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { GraphQLResolver } from '../libs/decorators';
import { getAllResolvers, getResolverMetadata, isResolver } from '../libs/metadata/MetadataReader';
import { resolverRegistry } from '../libs/metadata/ResolverRegistry';

describe('MetadataReader.getAllResolvers', () => {
  beforeEach(() => {
    resolverRegistry.clear();
  });

  it('should return empty array when no resolvers registered', () => {
    const resolvers = getAllResolvers();
    expect(Array.isArray(resolvers)).toBe(true);
    expect(resolvers.length).toBe(0);
  });

  it('should return all registered resolvers', () => {
    @GraphQLResolver()
    class FirstResolver {}

    @GraphQLResolver()
    class SecondResolver {}

    const resolvers = getAllResolvers();
    expect(resolvers.length).toBe(2);
    expect(resolvers).toContain(FirstResolver);
    expect(resolvers).toContain(SecondResolver);
  });

  it('should not leak resolver list mutation across consumers (e.g. multiple servers)', () => {
    @GraphQLResolver()
    class ResolverA {}

    const serverAResolvers = getAllResolvers();

    class NotRegisteredResolver {}

    serverAResolvers.push(NotRegisteredResolver);

    const serverBResolvers = getAllResolvers();
    expect(serverBResolvers).toContain(ResolverA);
    expect(serverBResolvers).not.toContain(NotRegisteredResolver);
  });
});

describe('GraphQLResolver decorator', () => {
  beforeEach(() => {
    resolverRegistry.clear();
  });

  it('should define resolver metadata with target', () => {
    @GraphQLResolver()
    class TestResolver {}

    const meta = getResolverMetadata(TestResolver);
    expect(meta).toBeDefined();
    expect(meta?.target).toBe(TestResolver);
  });

  it('should work with different scopes', () => {
    @GraphQLResolver({ scope: 'request' })
    class RequestScopedResolver {}

    const meta = getResolverMetadata(RequestScopedResolver);
    expect(meta).toBeDefined();
    expect(meta?.target).toBe(RequestScopedResolver);
  });
});

describe('MetadataReader.isResolver', () => {
  beforeEach(() => {
    resolverRegistry.clear();
  });

  it('should return true for classes decorated with @GraphQLResolver', () => {
    @GraphQLResolver()
    class TestResolver {}

    expect(isResolver(TestResolver)).toBe(true);
  });

  it('should return false for classes without @GraphQLResolver decorator', () => {
    class NotResolver {}

    expect(isResolver(NotResolver)).toBe(false);
  });
});

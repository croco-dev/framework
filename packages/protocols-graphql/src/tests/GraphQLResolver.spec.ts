import "reflect-metadata";
import { MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { RESOLVERS_KEY } from "../libs/constants";
import { GraphQLResolver } from "../libs/decorators";
import {
  getAllResolvers,
  getAllResolversFromRegistry,
  getResolverMetadata,
  isResolver,
} from "../libs/metadata/MetadataReader";
import { ResolverRegistry, resolverRegistry } from "../libs/metadata/ResolverRegistry";

describe("MetadataReader.getAllResolvers", () => {
  beforeEach(() => {
    resolverRegistry.clear();
    MetadataStorage.clear();
  });

  it("should return empty array when no resolvers registered", () => {
    const resolvers = getAllResolvers();
    expect(Array.isArray(resolvers)).toBe(true);
    expect(resolvers.length).toBe(0);
  });

  it("should return all registered resolvers", () => {
    @GraphQLResolver()
    class FirstResolver {}

    @GraphQLResolver()
    class SecondResolver {}

    const resolvers = getAllResolvers();
    expect(resolvers.length).toBe(2);
    expect(resolvers).toContain(FirstResolver);
    expect(resolvers).toContain(SecondResolver);
  });

  it("should not leak resolver list mutation across consumers (e.g. multiple servers)", () => {
    @GraphQLResolver()
    class ResolverA {}

    const serverAResolvers = getAllResolvers();

    class NotRegisteredResolver {}

    serverAResolvers.push(NotRegisteredResolver);

    const serverBResolvers = getAllResolvers();
    expect(serverBResolvers).toContain(ResolverA);
    expect(serverBResolvers).not.toContain(NotRegisteredResolver);
  });

  it("should allow isolated resolver registries", () => {
    @GraphQLResolver()
    class ResolverA {}

    const isolatedRegistry = ResolverRegistry.fromMetadata([ResolverA]);

    expect(getAllResolversFromRegistry(isolatedRegistry)).toContain(ResolverA);
    expect(getAllResolversFromRegistry(resolverRegistry)).toHaveLength(0);
  });
});

describe("GraphQLResolver decorator", () => {
  beforeEach(() => {
    resolverRegistry.clear();
    MetadataStorage.clear();
  });

  it("should define resolver metadata with target", () => {
    @GraphQLResolver()
    class TestResolver {}

    const meta = getResolverMetadata(TestResolver);
    expect(meta).not.toBeUndefined();
    expect(meta?.target).toBe(TestResolver);
    expect(MetadataStorage.get<boolean>(RESOLVERS_KEY, TestResolver)).toBe(true);
    expect(getAllResolversFromRegistry(resolverRegistry)).toHaveLength(0);
  });

  it("should work with different scopes", () => {
    @GraphQLResolver({ scope: "request" })
    class RequestScopedResolver {}

    const meta = getResolverMetadata(RequestScopedResolver);
    expect(meta).not.toBeUndefined();
    expect(meta?.target).toBe(RequestScopedResolver);
  });
});

describe("MetadataReader.isResolver", () => {
  beforeEach(() => {
    resolverRegistry.clear();
    MetadataStorage.clear();
  });

  it("should return true for classes decorated with @GraphQLResolver", () => {
    @GraphQLResolver()
    class TestResolver {}

    expect(isResolver(TestResolver)).toBe(true);
  });

  it("should return false for classes without @GraphQLResolver decorator", () => {
    class NotResolver {}

    expect(isResolver(NotResolver)).toBe(false);
  });
});

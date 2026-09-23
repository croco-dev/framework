import "reflect-metadata";
import {
  Container,
  GENERATED_DI_GRAPH_VERSION,
  MetadataStorage,
  defineGeneratedDiGraph,
} from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
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
    Container.reset();
    resolverRegistry.clear();
    MetadataStorage.clear();
  });

  it("should return empty array when no resolvers registered", () => {
    const resolvers = getAllResolvers();
    expect(Array.isArray(resolvers)).toBe(true);
    expect(resolvers.length).toBe(0);
  });

  it("should return resolvers from the installed generated graph", () => {
    @GraphQLResolver()
    class FirstResolver {}

    @GraphQLResolver()
    class SecondResolver {}

    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "graphql-test",
        compilerVersion: "test",
        inputHash: "test",
        roots: [FirstResolver, SecondResolver],
        providers: [FirstResolver, SecondResolver].map((resolver) => ({
          token: resolver,
          tokenId: `app:${resolver.name}`,
          debugName: resolver.name,
          kind: "graphql-resolver" as const,
          scope: "singleton" as const,
          dependencies: [],
          factory: () => new resolver(),
          sourceLocation: { file: `src/${resolver.name}.ts` },
        })),
      }),
    );

    const resolvers = getAllResolvers();
    expect(resolvers.length).toBe(2);
    expect(resolvers).toContain(FirstResolver);
    expect(resolvers).toContain(SecondResolver);
  });

  it("should not discover a decorated resolver before its generated graph is installed", () => {
    @GraphQLResolver()
    class ResolverA {}

    expect(getAllResolvers()).not.toContain(ResolverA);
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
    Container.reset();
    resolverRegistry.clear();
    MetadataStorage.clear();
  });

  it("should define resolver metadata with target", () => {
    @GraphQLResolver()
    class TestResolver {}

    const meta = getResolverMetadata(TestResolver);
    expect(meta).not.toBeUndefined();
    expect(meta?.target).toBe(TestResolver);
    expect(meta?.scope).toBe("singleton");
    expect(getAllResolversFromRegistry(resolverRegistry)).toHaveLength(0);
  });

  it("should work with different scopes", () => {
    @GraphQLResolver({ scope: "request" })
    class RequestScopedResolver {}

    const meta = getResolverMetadata(RequestScopedResolver);
    expect(meta).not.toBeUndefined();
    expect(meta?.target).toBe(RequestScopedResolver);
    expect(meta?.scope).toBe("request");
  });
});

describe("MetadataReader.isResolver", () => {
  beforeEach(() => {
    Container.reset();
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

import { GraphQLObjectType, GraphQLSchema, GraphQLString } from "graphql";
import { afterEach, describe, expect, it, vi } from "vitest";

function createTestSchema(): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: {
        hello: {
          type: GraphQLString,
          resolve: () => "hello",
        },
      },
    }),
  });
}

describe("GraphQLServer lazy SchemaCompiler loading", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock("../libs/SchemaCompiler");
  });

  it("does not load SchemaCompiler when schema is provided directly", async () => {
    vi.doMock("../libs/SchemaCompiler", () => {
      throw new Error("SchemaCompiler should not be imported");
    });

    const { GraphQLServer } = await import("../libs/GraphQLServer");
    const server = new GraphQLServer({
      schema: createTestSchema(),
    });

    await expect(server.initialize()).resolves.toBeUndefined();
  });

  it("loads SchemaCompiler when schemaOptions are provided", async () => {
    const compileSchema = vi.fn().mockResolvedValue(createTestSchema());

    vi.doMock("../libs/SchemaCompiler", () => ({
      SchemaCompiler: {
        compileSchema,
      },
    }));

    const { GraphQLServer } = await import("../libs/GraphQLServer");
    const server = new GraphQLServer({
      schemaOptions: {
        autoDiscover: false,
      },
    });

    await expect(server.initialize()).resolves.toBeUndefined();
    expect(compileSchema).toHaveBeenCalledWith({
      autoDiscover: false,
    });
  });
});

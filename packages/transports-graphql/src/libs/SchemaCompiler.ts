import "reflect-metadata";
import { getAllResolvers } from "@croco/protocols-graphql";
import type { GraphQLSchema } from "graphql";
import { type BuildSchemaOptions, buildSchema, type NonEmptyArray } from "type-graphql";
import { GraphQLResolversNotConfiguredProblem } from "./problems/GraphQLTransportProblems";
import type { SchemaCompileOptions } from "./types";

export class SchemaCompiler {
  static async compileSchema(options: SchemaCompileOptions = {}): Promise<GraphQLSchema> {
    const {
      resolvers: manualResolvers,
      autoDiscover = true,
      container,
      emitSchemaFile,
      validate,
    } = options;

    const resolvers = [...(manualResolvers || [])];

    if (autoDiscover) {
      const discoveredResolvers = getAllResolvers();
      resolvers.push(...discoveredResolvers);
    }

    const [firstResolver, ...remainingResolvers] = resolvers;

    if (!firstResolver) {
      throw new GraphQLResolversNotConfiguredProblem();
    }

    const schemaResolvers: NonEmptyArray<Function> = [firstResolver, ...remainingResolvers];

    const buildOptions: BuildSchemaOptions = {
      resolvers: schemaResolvers,
      ...(container !== undefined ? { container } : {}),
      ...(emitSchemaFile !== undefined ? { emitSchemaFile } : {}),
      ...(validate !== undefined ? { validate } : {}),
    };

    return buildSchema(buildOptions);
  }
}

import "reflect-metadata";
import { getAllResolvers } from "@croco/protocols-graphql";
import type { GraphQLSchema } from "graphql";
import { type BuildSchemaOptions, buildSchema, type NonEmptyArray } from "type-graphql";
import {
  bindGraphQLSubscriptionPolicies,
  createGraphQLExecutionMiddleware,
} from "./GraphQLExecutionMiddleware";
import { GraphQLResolversNotConfiguredProblem } from "./problems/GraphQLTransportProblems";
import type { SchemaCompileOptions } from "./types";

export class SchemaCompiler {
  static async compileSchema(options: SchemaCompileOptions = {}): Promise<GraphQLSchema> {
    const {
      resolvers: manualResolvers,
      autoDiscover = true,
      container,
      emitSchemaFile,
      pubSub,
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
      globalMiddlewares: [createGraphQLExecutionMiddleware(schemaResolvers)],
      ...(emitSchemaFile !== undefined ? { emitSchemaFile } : {}),
      ...(pubSub !== undefined ? { pubSub } : {}),
      ...(validate !== undefined ? { validate } : {}),
    };

    const schema = await buildSchema(buildOptions);
    bindGraphQLSubscriptionPolicies(schema, schemaResolvers);
    return schema;
  }
}

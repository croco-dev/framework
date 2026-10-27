import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
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

    const runInApplication = Container.captureCurrentScopeRunner();
    const standaloneInstances = new Map<Function, unknown>();
    const selectedResolvers = new Set<Function>(schemaResolvers);
    const assertContainerAvailable = (target: Function): void => {
      if (
        autoDiscover &&
        selectedResolvers.has(target) &&
        !Container.has(target as new (...args: never[]) => unknown)
      ) {
        throw ProblemFactory.internalServerError(
          "transports-graphql/resolver-container-required",
          `Resolver '${target.name}' is not registered in the application. Install its generated graph, provide a custom container, or set autoDiscover: false for standalone manual resolution.`,
        );
      }
    };
    if (container === undefined) {
      schemaResolvers.forEach(assertContainerAvailable);
    }

    const resolverContainer = container ?? {
      get<T>(target: new (...args: never[]) => T): T {
        return runInApplication(() => {
          if (Container.has(target)) {
            return Container.get(target);
          }
          assertContainerAvailable(target);
          if (!standaloneInstances.has(target)) {
            standaloneInstances.set(target, new target());
          }
          return standaloneInstances.get(target) as T;
        });
      },
    };

    const buildOptions: BuildSchemaOptions = {
      resolvers: schemaResolvers,
      container: resolverContainer,
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

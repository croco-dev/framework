import 'reflect-metadata';
import { getAllResolvers } from '@croco/protocols-graphql';
import type { GraphQLSchema } from 'graphql';
import { buildSchema } from 'type-graphql';
import type { SchemaCompileOptions } from './types';

export class SchemaCompiler {
  static async compileSchema(options: SchemaCompileOptions = {}): Promise<GraphQLSchema> {
    const { resolvers: manualResolvers, autoDiscover = true, container, emitSchemaFile, validate } = options;

    const buildOptions: {
      resolvers: Function[];
      container?: unknown;
      emitSchemaFile?: boolean | string;
      validate?: boolean;
    } = {
      resolvers: [...(manualResolvers || [])],
    };

    if (autoDiscover) {
      const discoveredResolvers = getAllResolvers();
      buildOptions.resolvers.push(...discoveredResolvers);
    }

    if (buildOptions.resolvers.length === 0) {
      throw new Error('No resolvers provided. Provide resolvers manually or enable autoDiscover.');
    }

    if (container) {
      buildOptions.container = container;
    }

    if (emitSchemaFile !== undefined) {
      buildOptions.emitSchemaFile = emitSchemaFile;
    }

    if (validate !== undefined) {
      buildOptions.validate = validate;
    }

    return buildSchema(buildOptions as never);
  }
}

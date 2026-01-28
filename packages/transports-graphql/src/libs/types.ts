import type { GraphQLSchema } from 'graphql';
import type { YogaServerOptions } from 'graphql-yoga';
import type { Container as ContainerClass } from 'typedi';

export type ContainerType = ContainerClass;

export type SchemaCompileOptions = {
  resolvers?: Function[];
  autoDiscover?: boolean;
  container?: ContainerType;
  emitSchemaFile?: boolean | string;
  validate?: boolean;
};

export type GraphQLServerOptions = {
  schema?: GraphQLSchema;
  schemaOptions?: SchemaCompileOptions;
  context?: (req: Request) => Promise<Record<string, unknown>> | Record<string, unknown>;
  graphqlEndpoint?: string;
  cors?: boolean | YogaServerOptions<Record<string, unknown>, unknown>['cors'];
  plugins?: YogaServerOptions<Record<string, unknown>, unknown>['plugins'];
};

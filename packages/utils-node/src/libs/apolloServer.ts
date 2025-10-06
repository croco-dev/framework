import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { buildSchema, AuthChecker, NonEmptyArray, BuildSchemaOptions } from 'type-graphql';
import { Container } from 'typedi';

type ResolverClass = new (...args: unknown[]) => unknown;

interface ApolloServerConfig<ApolloContext extends object> {
  resolvers: NonEmptyArray<ResolverClass>;
  authChecker?: AuthChecker<ApolloContext>;
  context?: ({ event, context }: { event: APIGatewayProxyEventV2; context: Context }) => Promise<ApolloContext>;
  schemaOptions?: Partial<BuildSchemaOptions>;
}

export function createApolloServer<Context extends object>(
  config: ApolloServerConfig<Context>
): APIGatewayProxyHandlerV2 {
  let cachedHandler: APIGatewayProxyHandlerV2 | null = null;

  return async (event, context, callback) => {
    if (!cachedHandler) {
      const schema = await buildSchema({
        resolvers: config.resolvers,
        authChecker: config.authChecker,
        container: Container,
        ...config.schemaOptions,
      });

      const server = new ApolloServer({ schema });

      cachedHandler = startServerAndCreateLambdaHandler(server, handlers.createAPIGatewayProxyEventV2RequestHandler(), {
        context: async ({ event, context }) => {
          if (config.context) {
            return config.context({ event, context });
          }
          return {};
        },
      });
    }

    return cachedHandler(event, context, callback) as Promise<APIGatewayProxyResultV2>;
  };
}

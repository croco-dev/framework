import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
import { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { buildSchema } from 'type-graphql';
import { AuthChecker, NonEmptyArray } from 'type-graphql';
import { Container } from 'typedi';

type ResolverClass = new (...args: unknown[]) => unknown;

interface ApolloServerConfig {
  resolvers: NonEmptyArray<ResolverClass>;
  authChecker?: AuthChecker<Record<string, unknown>>;
  context?: ({
    event,
    context,
  }: {
    event: APIGatewayProxyEventV2;
    context: Context;
  }) => Promise<Record<string, unknown>>;
}

export function createApolloServer(config: ApolloServerConfig): APIGatewayProxyHandlerV2 {
  let cachedHandler: APIGatewayProxyHandlerV2 | null = null;

  return async (event, context, callback) => {
    if (!cachedHandler) {
      const schema = await buildSchema({
        resolvers: config.resolvers,
        authChecker: config.authChecker,
        container: Container,
      });

      const server = new ApolloServer({ schema });

      cachedHandler = startServerAndCreateLambdaHandler(
        server,
        handlers.createAPIGatewayProxyEventV2RequestHandler(),
        {
          context: async ({ event, context }) => {
            if (config.context) {
              return config.context({ event, context });
            }
            return {};
          },
        }
      );
    }

    return (cachedHandler as APIGatewayProxyHandlerV2)(event, context, callback) as Promise<APIGatewayProxyResultV2>;
  };
}

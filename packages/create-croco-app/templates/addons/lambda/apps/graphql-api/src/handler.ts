import { ApolloServer } from '@apollo/server';
import { handlers, startServerAndCreateLambdaHandler } from '@as-integrations/aws-lambda';
import { lambdaPreset, TelemetryRuntime } from '@croco/telemetry-sdk-node';
import { createSchema } from './schema.js';

const telemetry = TelemetryRuntime.getInstance();
const telemetryReady = telemetry.init(
  lambdaPreset({
    serviceName: 'graphql-api',
  })
);

let lambdaHandlerPromise: Promise<ReturnType<typeof startServerAndCreateLambdaHandler>> | null = null;

function getLambdaHandler(): Promise<ReturnType<typeof startServerAndCreateLambdaHandler>> {
  if (!lambdaHandlerPromise) {
    lambdaHandlerPromise = createSchema()
      .then((schema) => {
        const server = new ApolloServer({ schema });

        return startServerAndCreateLambdaHandler(server, handlers.createAPIGatewayProxyEventV2RequestHandler());
      })
      .catch((error: unknown) => {
        lambdaHandlerPromise = null;
        throw error;
      });
  }

  return lambdaHandlerPromise;
}

type GraphqlLambdaHandler = Awaited<ReturnType<typeof getLambdaHandler>>;

export const handler = async (
  ...args: Parameters<GraphqlLambdaHandler>
): Promise<Awaited<ReturnType<GraphqlLambdaHandler>>> => {
  try {
    await telemetryReady;
    const lambdaHandler = await getLambdaHandler();

    return await lambdaHandler(...args);
  } finally {
    await telemetry.forceFlush();
  }
};

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

const lambdaHandlerPromise = createSchema().then((schema) => {
  const server = new ApolloServer({ schema });

  return startServerAndCreateLambdaHandler(server, handlers.createAPIGatewayProxyEventV2RequestHandler());
});

export const handler = async (
  ...args: Parameters<Awaited<typeof lambdaHandlerPromise>>
): Promise<Awaited<ReturnType<Awaited<typeof lambdaHandlerPromise>>>> => {
  try {
    await telemetryReady;
    const lambdaHandler = await lambdaHandlerPromise;

    return await lambdaHandler(...args);
  } finally {
    await telemetry.forceFlush();
  }
};

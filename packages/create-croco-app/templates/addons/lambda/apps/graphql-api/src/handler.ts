import { ApolloServer } from "@apollo/server";
import { handlers, startServerAndCreateLambdaHandler } from "@as-integrations/aws-lambda";
import { lambdaPreset, TelemetryRuntime } from "@croco/telemetry-sdk-node";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { formatCrocoGraphQLError } from "./formatGraphQLError.js";
import { createGraphQLContext, createSchema } from "./schema.js";
import { runWithTelemetryFlush } from "./telemetryFlush.js";
import type { GraphQLAuthContext } from "./schema.js";

const telemetry = TelemetryRuntime.getInstance();
const telemetryReady = telemetry.init(
  lambdaPreset({
    serviceName: "graphql-api",
  }),
);

const lambdaHandlerPromise: Promise<APIGatewayProxyHandlerV2> = createSchema().then((schema) => {
  const server = new ApolloServer<GraphQLAuthContext>({
    schema,
    formatError: formatCrocoGraphQLError,
  });

  return startServerAndCreateLambdaHandler(
    server,
    handlers.createAPIGatewayProxyEventV2RequestHandler(),
    {
      context: async ({ event }) => createGraphQLContext(event.headers),
    },
  );
});

export const handler = async (
  ...args: Parameters<APIGatewayProxyHandlerV2>
): Promise<Awaited<ReturnType<APIGatewayProxyHandlerV2>>> => {
  await telemetryReady;
  const lambdaHandler = await lambdaHandlerPromise;

  return runWithTelemetryFlush(
    async () => lambdaHandler(...args),
    () => telemetry.forceFlush(),
  );
};

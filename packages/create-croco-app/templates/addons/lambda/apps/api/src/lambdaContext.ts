import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda";
import type { Context } from "./context.js";

export function createLambdaContext({
  event,
}: CreateAWSLambdaContextOptions<APIGatewayProxyEventV2>): Context {
  return { headers: event.headers };
}

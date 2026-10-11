import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { createLambdaContext } from "./lambdaContext.js";
import { appRouter } from "./router.js";

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext: createLambdaContext,
});

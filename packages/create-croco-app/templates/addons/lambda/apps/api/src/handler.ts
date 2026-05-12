import { awsLambdaRequestHandler } from "@trpc/server/adapters/aws-lambda";
import { createContext } from "./context.js";
import { appRouter } from "./router.js";

export const handler = awsLambdaRequestHandler({
  router: appRouter,
  createContext,
});

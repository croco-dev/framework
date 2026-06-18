import "reflect-metadata";
import { createLambdaExampleApp, startLocalServer } from "./app/bootstrap";

const app = createLambdaExampleApp();
export const handler = app.lambdaHandler();

const isLambdaRuntime =
  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
  process.env.LAMBDA_TASK_ROOT !== undefined ||
  process.env.AWS_EXECUTION_ENV?.includes("AWS_Lambda") === true;

if (process.env.NODE_ENV !== "production" && !isLambdaRuntime) {
  startLocalServer(app);
}

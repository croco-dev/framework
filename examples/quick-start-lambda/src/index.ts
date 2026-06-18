import "reflect-metadata";
import { createLambdaExampleApp, startLocalServer } from "./app/bootstrap";

const app = createLambdaExampleApp();
export const handler = app.lambdaHandler();

if (process.env.NODE_ENV !== "production") {
  startLocalServer(app);
}

import "reflect-metadata";
import type { LambdaContext, LambdaEvent, LambdaResponse } from "@croco/transports-http";
import { createGoldenPathRuntime, startLocalServer } from "./app/bootstrap";

const runtime = createGoldenPathRuntime();

export async function handler(event: LambdaEvent, context: LambdaContext): Promise<LambdaResponse> {
  const { app, applicationRuntime, flushTelemetry } = await runtime;
  const callback = applicationRuntime.run(() => app.lambdaHandler({ flush: flushTelemetry }));
  return await applicationRuntime.bindHostCallback(callback)(event, context);
}

const isLambdaRuntime =
  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
  process.env.LAMBDA_TASK_ROOT !== undefined ||
  process.env.AWS_EXECUTION_ENV?.includes("AWS_Lambda") === true;

if (process.env.NODE_ENV !== "production" && !isLambdaRuntime) {
  void runtime.then((application) => {
    startLocalServer(application);
  });
}

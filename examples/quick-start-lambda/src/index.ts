import "reflect-metadata";
import {
  TelemetryForceFlushUnsupportedProblem,
  TelemetryRuntime,
  lambdaPreset,
} from "@croco/telemetry-sdk-node";
import { createLambdaExampleRuntime, startLocalServer } from "./app/bootstrap";
import type { LambdaHandler } from "@croco/transports-http";

const isLambdaRuntime =
  process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
  process.env.LAMBDA_TASK_ROOT !== undefined ||
  process.env.AWS_EXECUTION_ENV?.includes("AWS_Lambda") === true;
const telemetry = TelemetryRuntime.getInstance();
const telemetryConfig = lambdaPreset({ serviceName: "quick-start-lambda" });
const telemetryReady = telemetry.init({
  ...telemetryConfig,
  enabled:
    telemetryConfig.enabled !== false &&
    (isLambdaRuntime || telemetryConfig.trace?.exporterUrl !== undefined),
});
const runtimeReady = createLambdaExampleRuntime();
const lambdaHandlerReady = runtimeReady.then((runtime) =>
  runtime.applicationRuntime.run(() =>
    runtime.applicationRuntime.bindHostCallback(
      runtime.app.lambdaHandler({
        flush: async () => {
          const result = await telemetry.forceFlush();
          if (result.outcome === "failed") {
            throw result.error;
          }
          if (result.outcome === "unsupported") {
            throw new TelemetryForceFlushUnsupportedProblem();
          }
        },
      }),
    ),
  ),
);

export const handler: LambdaHandler = async (...args) => {
  await telemetryReady;
  const lambdaHandler = await lambdaHandlerReady;
  return lambdaHandler(...args);
};

if (process.env.NODE_ENV !== "production" && !isLambdaRuntime) {
  void runtimeReady
    .then((runtime) => {
      const host = startLocalServer(runtime);
      if (!host) {
        return;
      }

      const shutdown = () => {
        void host
          .close()
          .then(() => runtime.applicationRuntime.dispose())
          .catch((error: unknown) => {
            console.error("Failed to stop local server", error);
            process.exitCode = 1;
          });
      };
      process.once("SIGINT", shutdown);
      process.once("SIGTERM", shutdown);
    })
    .catch((error: unknown) => {
      console.error("Failed to initialize local server", error);
      process.exitCode = 1;
    });
}

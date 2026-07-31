import "reflect-metadata";
import {
  TelemetryForceFlushUnsupportedProblem,
  TelemetryRuntime,
  lambdaPreset,
} from "@croco/telemetry-sdk-node";
import { createLambdaExampleApp, startLocalServer } from "./app/bootstrap";

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
const app = createLambdaExampleApp();
const lambdaHandler = app.lambdaHandler({
  flush: async () => {
    const result = await telemetry.forceFlush();
    if (result.outcome === "failed") {
      throw result.error;
    }
    if (result.outcome === "unsupported") {
      throw new TelemetryForceFlushUnsupportedProblem();
    }
  },
});

export const handler = async (
  ...args: Parameters<typeof lambdaHandler>
): Promise<Awaited<ReturnType<typeof lambdaHandler>>> => {
  await telemetryReady;
  return lambdaHandler(...args);
};

if (process.env.NODE_ENV !== "production" && !isLambdaRuntime) {
  startLocalServer(app);
}

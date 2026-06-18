import { TelemetryRuntime } from "@croco/telemetry-sdk-node";
import { createCrocoApp } from "./app";
import { createTelemetryConfig, readEnv } from "./env";

const telemetry = TelemetryRuntime.getInstance();
const env = readEnv();
const telemetryReady = telemetry.init(createTelemetryConfig({ ...env, NODE_ENV: "production" }));
const crocoHandler = createCrocoApp().lambdaHandler();

export const handler = async (
  ...args: Parameters<typeof crocoHandler>
): Promise<Awaited<ReturnType<typeof crocoHandler>>> => {
  try {
    await telemetryReady;

    return await crocoHandler(...args);
  } finally {
    await telemetry.forceFlush();
  }
};

import { TelemetryRuntime } from "@croco/telemetry-sdk-node";
import { createCrocoApp } from "./app";
import { createTelemetryConfig, readEnv } from "./env";

const telemetry = TelemetryRuntime.getInstance();
const env = readEnv();
const telemetryReady = telemetry.init(createTelemetryConfig({ ...env, NODE_ENV: "production" }));
const crocoHandler = createCrocoApp().lambdaHandler({
  flush: async () => {
    const flush = await telemetry.forceFlush();
    if (flush.outcome === "failed") {
      throw flush.error;
    }
    if (flush.outcome === "unsupported") {
      throw new Error("Telemetry forceFlush is unsupported before initialization.");
    }
  },
});

export const handler = async (
  ...args: Parameters<typeof crocoHandler>
): Promise<Awaited<ReturnType<typeof crocoHandler>>> => {
  await telemetryReady;
  return crocoHandler(...args);
};

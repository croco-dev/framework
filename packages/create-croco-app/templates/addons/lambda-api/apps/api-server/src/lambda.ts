import { defineCrocoApplication } from "@croco/framework-module";
import { createLambdaHost } from "@croco/preset-lambda";
import type { LambdaHost } from "@croco/preset-lambda";
import {
  nodeTelemetry,
  TELEMETRY_RUNTIME_TOKEN,
  TelemetryForceFlushUnsupportedProblem,
} from "@croco/telemetry-sdk-node";
import { createCrocoApp } from "./app";
import type { CreateCrocoAppOptions } from "./app";
import { createTelemetryConfig, readEnv } from "./env";

export async function createLambdaApplication(
  options: Omit<CreateCrocoAppOptions, "application"> = {},
) {
  const app = createCrocoApp({
    ...options,
    application: defineCrocoApplication({
      name: "lambda-api",
      imports: [nodeTelemetry(createTelemetryConfig({ ...readEnv(), NODE_ENV: "production" }))],
    }),
  });
  try {
    await app.applicationRuntime.initialize();
  } catch (error) {
    await app.disposeApplicationRuntime();
    throw error;
  }
  const telemetry = app.applicationRuntime.get(TELEMETRY_RUNTIME_TOKEN);
  const host = createLambdaHost(app.getHono(), {
    flush: async () => {
      const result = await telemetry.forceFlush();
      if (result.outcome === "failed") throw result.error;
      if (result.outcome === "unsupported") throw new TelemetryForceFlushUnsupportedProblem();
    },
  });
  return {
    app,
    handler: app.applicationRuntime.bindHostCallback(host),
    close: () => app.disposeApplicationRuntime(),
  };
}

// A warm invocation reuses this application's graph. Initialization failures stay explicit.
let ready: ReturnType<typeof createLambdaApplication> | undefined;
export const handler: LambdaHost = async (event, context) => {
  ready ??= createLambdaApplication();
  return (await ready).handler(event, context);
};

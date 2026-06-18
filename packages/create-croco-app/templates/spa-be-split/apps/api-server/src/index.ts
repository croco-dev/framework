import { TelemetryRuntime } from "@croco/telemetry-sdk-node";
import { createCrocoApp } from "./app";
import { createTelemetryConfig, readEnv } from "./env";

const telemetry = TelemetryRuntime.getInstance();

async function main(): Promise<void> {
  const env = readEnv();
  await telemetry.init(createTelemetryConfig(env));

  const app = createCrocoApp();
  await app.listen(env.PORT);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

import { TelemetryRuntime } from "@croco/telemetry-sdk-node";
import { createCrocoApp } from "./app";
import { InvalidPortProblem } from "./problems";

const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const telemetryReady = TelemetryRuntime.getInstance().init({
  serviceName: "saas-api-server",
  environment: process.env.NODE_ENV ?? "development",
  enabled: process.env.TELEMETRY_ENABLED !== "false",
  trace: {
    enabled: process.env.TELEMETRY_ENABLED === "true" || otlpEndpoint !== undefined,
    exporterUrl: otlpEndpoint,
  },
});

function parsePort(value: string | undefined): number {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidPortProblem(value);
  }

  return port;
}

async function main(): Promise<void> {
  await telemetryReady;
  const port = parsePort(process.env.PORT);
  const app = createCrocoApp();

  await app.listen(port);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

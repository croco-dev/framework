import type { TelemetryConfig } from "@croco/telemetry-sdk-node";
import { z } from "zod";
import { InvalidEnvironmentProblem } from "./problems";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  TELEMETRY_ENABLED: z.enum(["true", "false"]).default("false"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new InvalidEnvironmentProblem(detail);
  }

  return result.data;
}

export function createTelemetryConfig(env: AppEnv): TelemetryConfig {
  const exporterUrl = normalizeOptionalEnv(
    env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || env.OTEL_EXPORTER_OTLP_ENDPOINT,
  );
  const traceEnabled = env.TELEMETRY_ENABLED === "true" || exporterUrl !== undefined;

  return {
    serviceName: "{{projectName}}-api-server",
    environment: env.NODE_ENV,
    enabled: traceEnabled,
    trace: {
      enabled: traceEnabled,
      exporterUrl,
      probability: env.NODE_ENV === "production" ? 0.1 : 1,
    },
  };
}

function normalizeOptionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

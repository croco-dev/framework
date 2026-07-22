import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import type { TelemetryConfig } from "../../config";

const DEFAULT_DEPLOYMENT_ENVIRONMENT = "development";

function resolveDeploymentEnvironment(config: TelemetryConfig): string {
  if (config.environment !== undefined) {
    return config.environment;
  }

  const resourceEnvironment = config.resourceAttributes?.[ATTR_DEPLOYMENT_ENVIRONMENT_NAME];
  return typeof resourceEnvironment === "string"
    ? resourceEnvironment
    : DEFAULT_DEPLOYMENT_ENVIRONMENT;
}

export { resolveDeploymentEnvironment };

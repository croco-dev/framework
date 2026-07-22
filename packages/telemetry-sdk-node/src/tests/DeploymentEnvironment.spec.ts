import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from "@opentelemetry/semantic-conventions";
import { describe, expect, it } from "vitest";
import { resolveDeploymentEnvironment } from "../libs/resources/DeploymentEnvironment";

describe("resolveDeploymentEnvironment", () => {
  it("should prefer the top-level environment over the stable resource attribute", () => {
    expect(
      resolveDeploymentEnvironment({
        serviceName: "orders",
        environment: "production",
        resourceAttributes: {
          [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: "staging",
        },
      }),
    ).toBe("production");
  });

  it("should preserve a stable resource environment when the top-level option is omitted", () => {
    expect(
      resolveDeploymentEnvironment({
        serviceName: "orders",
        resourceAttributes: {
          [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: "staging",
        },
      }),
    ).toBe("staging");
  });

  it("should default to development when no string environment is configured", () => {
    expect(resolveDeploymentEnvironment({ serviceName: "orders" })).toBe("development");
    expect(
      resolveDeploymentEnvironment({
        serviceName: "orders",
        resourceAttributes: {
          [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: 1,
        },
      }),
    ).toBe("development");
  });
});

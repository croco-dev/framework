import { describe, expect, it } from "vitest";
import { PolarBillingDiagnosticsProvider } from "../libs/PolarBillingDiagnosticsProvider";

describe("PolarBillingDiagnosticsProvider", () => {
  it("reports missing required configuration without leaking secret values", async () => {
    const provider = new PolarBillingDiagnosticsProvider({
      accessToken: "polar-secret-token",
      environment: "sandbox",
      webhookSecret: "",
    });

    const health = await provider.getHealth();

    expect(health).toMatchObject({
      status: "unhealthy",
      component: "billing-polar",
      details: expect.objectContaining({
        provider: "polar",
        environment: "sandbox",
        hasAccessToken: true,
        hasWebhookSecret: false,
        problemCode: "billing-polar/missing-config",
      }),
    });
    expect(JSON.stringify(health)).not.toContain("polar-secret-token");
  });

  it("reports healthy readiness when required config exists and no live check is configured", async () => {
    const provider = new PolarBillingDiagnosticsProvider({
      accessToken: "polar-secret-token",
      environment: "sandbox",
      webhookSecret: "webhook-secret",
      organizationId: "org-123",
    });

    const health = await provider.getHealth();

    expect(health).toMatchObject({
      status: "healthy",
      component: "billing-polar",
      details: expect.objectContaining({
        provider: "polar",
        environment: "sandbox",
        hasAccessToken: true,
        hasWebhookSecret: true,
        hasOrganizationId: true,
        liveCheck: "not_configured",
      }),
    });
    expect(JSON.stringify(health)).not.toContain("polar-secret-token");
    expect(JSON.stringify(health)).not.toContain("webhook-secret");
  });

  it("sanitizes readiness details and normalizes live readiness failures", async () => {
    const healthyProvider = new PolarBillingDiagnosticsProvider(
      {
        accessToken: "polar-secret-token",
        environment: "sandbox",
        webhookSecret: "webhook-secret",
      },
      {
        readinessCheck: async () => ({
          details: {
            accessToken: "leaked-token",
            nested: {
              webhookSecret: "leaked-secret",
              safe: "visible",
            },
          },
        }),
      },
    );

    const healthy = await healthyProvider.getHealth();

    expect(healthy.status).toBe("healthy");
    expect(JSON.stringify(healthy)).not.toContain("leaked-token");
    expect(JSON.stringify(healthy)).not.toContain("leaked-secret");
    expect(healthy.details).toMatchObject({
      readiness: {
        accessToken: "[redacted]",
        nested: {
          webhookSecret: "[redacted]",
          safe: "visible",
        },
      },
    });

    const failingProvider = new PolarBillingDiagnosticsProvider(
      {
        accessToken: "polar-secret-token",
        environment: "sandbox",
        webhookSecret: "webhook-secret",
      },
      {
        readinessCheck: async () => {
          throw Object.assign(new Error("Polar is unavailable"), {
            name: "ConnectionError",
          });
        },
      },
    );

    const failing = await failingProvider.getHealth();

    expect(failing).toMatchObject({
      status: "degraded",
      component: "billing-polar",
      details: expect.objectContaining({
        liveCheck: "failed",
        problemCode: "billing-polar/retryable-upstream",
      }),
    });
  });
});

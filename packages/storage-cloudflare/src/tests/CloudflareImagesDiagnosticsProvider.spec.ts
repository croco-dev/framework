import { describe, expect, it } from "vitest";
import { CloudflareImagesDiagnosticsProvider } from "../libs/CloudflareImagesDiagnosticsProvider";

const validConfig = {
  accountHash: "test-account-hash",
  accountId: "test-account-id",
  apiToken: "test-api-token",
  signingKey: "test-signing-key",
};

describe("CloudflareImagesDiagnosticsProvider", () => {
  it("reports unhealthy readiness when required configuration is missing", async () => {
    const provider = new CloudflareImagesDiagnosticsProvider({
      accountId: "test-account-id",
      apiToken: "test-api-token",
    });

    const health = await provider.getHealth();

    expect(health).toMatchObject({
      status: "unhealthy",
      component: "storage-cloudflare",
      details: {
        liveCheck: "not_started",
        problemCode: "storage-cloudflare/missing-config",
        problemStatus: 500,
        hasAccountId: true,
        hasApiToken: true,
        hasAccountHash: false,
      },
    });
  });

  it("reports healthy readiness without mutating upstream state when live check is not configured", async () => {
    const provider = new CloudflareImagesDiagnosticsProvider(validConfig);

    const health = await provider.getHealth();

    expect(health).toMatchObject({
      status: "healthy",
      component: "storage-cloudflare",
      details: {
        liveCheck: "not_configured",
        hasAccountId: true,
        hasApiToken: true,
        hasAccountHash: true,
        hasSigningKey: true,
        metadataSupport: {
          contentType: "unsupported",
          customMetadata: "unsupported",
        },
      },
    });
  });

  it("sanitizes readiness details returned by a live check", async () => {
    const provider = new CloudflareImagesDiagnosticsProvider(validConfig, {
      readinessCheck: async () => ({
        details: {
          accountId: "test-account-id",
          apiToken: "must-not-leak",
          nested: {
            signingKey: "must-not-leak",
          },
        },
      }),
    });

    const health = await provider.getHealth();

    expect(health).toMatchObject({
      status: "healthy",
      details: {
        liveCheck: "passed",
        readiness: {
          accountId: "test-account-id",
          apiToken: "[redacted]",
          nested: {
            signingKey: "[redacted]",
          },
        },
      },
    });
  });

  it("normalizes failed live checks to deterministic provider Problem codes", async () => {
    const provider = new CloudflareImagesDiagnosticsProvider(validConfig, {
      readinessCheck: async () => {
        throw Object.assign(new Error("Cloudflare API unavailable"), { status: 503 });
      },
    });

    const health = await provider.getHealth();

    expect(health).toMatchObject({
      status: "degraded",
      component: "storage-cloudflare",
      details: {
        liveCheck: "failed",
        problemCode: "storage-cloudflare/retryable-upstream",
        problemStatus: 500,
      },
    });
  });
});

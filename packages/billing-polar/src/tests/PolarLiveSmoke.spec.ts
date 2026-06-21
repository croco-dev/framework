import { Polar } from "@polar-sh/sdk";
import { describe, expect, it } from "vitest";
import { PolarBillingDiagnosticsProvider } from "../libs/PolarBillingDiagnosticsProvider";
import type { PolarConfig } from "../types";

const liveEnvironment = process.env.POLAR_ENVIRONMENT === "production" ? "production" : "sandbox";
const liveConfig: PolarConfig = {
  accessToken: process.env.POLAR_ACCESS_TOKEN ?? "",
  environment: liveEnvironment,
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
  organizationId: process.env.POLAR_ORGANIZATION_ID,
};

const missingLiveSmokeEnv = [
  ["POLAR_ACCESS_TOKEN", liveConfig.accessToken],
  ["POLAR_WEBHOOK_SECRET", liveConfig.webhookSecret],
  ["POLAR_ORGANIZATION_ID", liveConfig.organizationId],
]
  .filter(([, value]) => typeof value !== "string" || value.length === 0)
  .map(([name]) => name);

describe("Polar live smoke", () => {
  it.skipIf(missingLiveSmokeEnv.length > 0)(
    "requires POLAR_ACCESS_TOKEN, POLAR_WEBHOOK_SECRET, and POLAR_ORGANIZATION_ID for live Polar readiness smoke",
    async () => {
      const provider = new PolarBillingDiagnosticsProvider(liveConfig, {
        readinessCheck: async ({ config, signal }) => {
          const client = new Polar({
            accessToken: config.accessToken,
            server: config.environment,
          });

          await client.organizations.get(
            {
              id: config.organizationId ?? "",
            },
            {
              signal,
              timeoutMs: 10_000,
            },
          );

          return {
            details: {
              organizationId: config.organizationId,
            },
          };
        },
      });

      const health = await provider.getHealth();

      expect(health).toMatchObject({
        status: "healthy",
        component: "billing-polar",
        details: expect.objectContaining({
          liveCheck: "passed",
        }),
      });
    },
  );
});

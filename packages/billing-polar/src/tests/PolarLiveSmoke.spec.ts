import { Polar } from "@polar-sh/sdk";
import { defineMeter } from "@croco/metering-core";
import { buildContractGraph, getContractProviderMappingDriftInput } from "@croco/protocols-core";
import { describe, expect, it } from "vitest";
import { PolarBillingDiagnosticsProvider } from "../libs/PolarBillingDiagnosticsProvider";
import { POLAR_BILLING_PROVIDER_PROFILE } from "../libs/PolarBillingProviderProfile";
import { inspectPolarContractMappingDrift } from "../libs/PolarContractMappingPreflight";
import { bindPolarUsageMeter, PolarUsageBillingGateway } from "../libs/PolarUsageBillingGateway";
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

  const missingMappingEnv = [
    ["POLAR_ACCESS_TOKEN", liveConfig.accessToken],
    ["POLAR_PRODUCT_ID", process.env.POLAR_PRODUCT_ID],
    ["POLAR_PRICE_IDS", process.env.POLAR_PRICE_IDS],
  ]
    .filter(([, value]) => typeof value !== "string" || value.length === 0)
    .map(([name]) => name);

  it.skipIf(missingMappingEnv.length > 0)(
    "compares graph-derived product mappings through an opt-in read-only Polar preflight",
    async () => {
      const productId = process.env.POLAR_PRODUCT_ID ?? "";
      const priceIds = splitIds(process.env.POLAR_PRICE_IDS);
      const graph = buildContractGraph([], {
        monetization: {
          planVersions: [
            {
              ref: "polar-live@1",
              planId: "polar-live",
              versionId: "1",
              rating: { mode: "provider", provider: "polar" },
              providerBindings: [
                {
                  provider: "polar",
                  productId,
                  priceIds,
                },
              ],
            },
          ],
          providers: [POLAR_BILLING_PROVIDER_PROFILE],
        },
      });
      const monetization = graph.monetization;
      expect(monetization).toBeDefined();
      if (!monetization) return;

      const driftInput = getContractProviderMappingDriftInput(monetization, "polar");
      const drift = await inspectPolarContractMappingDrift(driftInput, {
        readProduct: async (id) => {
          const client = new Polar({
            accessToken: liveConfig.accessToken,
            server: liveConfig.environment,
          });
          return extractRemoteMapping(await client.products.get({ id }));
        },
      });

      expect(drift).toEqual([]);
    },
  );

  const missingUsageSmokeEnv = [
    ["POLAR_ACCESS_TOKEN", liveConfig.accessToken],
    ["POLAR_WEBHOOK_SECRET", liveConfig.webhookSecret],
    ["POLAR_USAGE_EXTERNAL_CUSTOMER_ID", process.env.POLAR_USAGE_EXTERNAL_CUSTOMER_ID],
    ["POLAR_USAGE_EVENT_NAME", process.env.POLAR_USAGE_EVENT_NAME],
    ["POLAR_USAGE_EVENT_ID", process.env.POLAR_USAGE_EVENT_ID],
    ["POLAR_USAGE_METER_ID", process.env.POLAR_USAGE_METER_ID],
  ]
    .filter(([, value]) => typeof value !== "string" || value.length === 0)
    .map(([name]) => name);

  it.skipIf(missingUsageSmokeEnv.length > 0)(
    "certifies a deliberate real usage event with a replay-safe external identity",
    async () => {
      const liveMeter = defineMeter({
        key: "polar.live.certification",
        aggregation: "COUNT",
        unit: "event",
        billing: "required",
      });
      const gateway = new PolarUsageBillingGateway(liveConfig, [
        bindPolarUsageMeter({
          meter: liveMeter,
          eventName: process.env.POLAR_USAGE_EVENT_NAME ?? "",
          providerMeterId: process.env.POLAR_USAGE_METER_ID ?? "",
        }),
      ]);

      const receipt = await gateway.ingest([
        {
          billingAccountId: process.env.POLAR_USAGE_EXTERNAL_CUSTOMER_ID ?? "",
          eventId: process.env.POLAR_USAGE_EVENT_ID ?? "",
          meterId: liveMeter.key,
          occurredAt: new Date(),
          value: 1,
        },
      ]);

      expect(receipt.receipts).toEqual([
        expect.objectContaining({
          eventId: process.env.POLAR_USAGE_EVENT_ID,
          status: expect.stringMatching(/^(inserted|duplicate)$/),
        }),
      ]);
    },
  );
});

function splitIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

function extractRemoteMapping(product: unknown): { priceIds: string[]; meterIds: string[] } {
  if (!isRecord(product) || !Array.isArray(product["prices"])) {
    return { priceIds: [], meterIds: [] };
  }
  const prices = product["prices"].filter(isRecord);
  return {
    priceIds: prices
      .flatMap((price) => (typeof price["id"] === "string" ? [price["id"]] : []))
      .sort(),
    meterIds: prices
      .flatMap((price) => {
        const meter = price["meter"];
        return isRecord(meter) && typeof meter["id"] === "string" ? [meter["id"]] : [];
      })
      .sort(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

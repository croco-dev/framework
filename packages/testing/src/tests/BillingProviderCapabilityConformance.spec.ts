import { describe, expect, it } from "vitest";
import {
  defineBillingProvider,
  defineBillingProviderProfile,
  type BillingGateway,
  type UsageBillingGateway,
} from "@croco/billing-core";
import { createBillingProviderConformanceSuite } from "../index";

const checkout: BillingGateway = {
  ensureCustomer: async () => "customer-1",
  createCheckout: async () => ({ checkoutId: "checkout-1", checkoutUrl: "https://example.test" }),
  reconcileCheckout: async () => null,
  cancelSubscription: async () => undefined,
  resumeSubscription: async () => undefined,
  getCustomerPortalUrl: async () => "https://example.test/portal",
};

const usage: UsageBillingGateway = {
  ingest: async () => ({ receipts: [] }),
  getCustomerMeterState: async () => null,
};

describe("billing provider capability conformance", () => {
  it("certifies usage independently from checkout and subscription behavior", async () => {
    const suite = createBillingProviderConformanceSuite({
      providerName: "Capability Provider",
      capabilities: {
        required: ["usage"],
        createProvider: () =>
          defineBillingProvider(
            defineBillingProviderProfile({
              providerName: "capability-provider",
              capabilities: {
                checkout: { supported: true },
                usage: { supported: true },
              },
            }),
            { checkout, usage },
          ),
      },
    });

    expect(suite.cases.map(({ name }) => name)).toEqual([
      "exposes an inspectable billing provider capability profile",
      "requires billing provider capability 'usage' independently",
    ]);
    for (const testCase of suite.cases) {
      await testCase.run();
    }
  });

  it("fails certification when a required usage capability is unavailable", async () => {
    const suite = createBillingProviderConformanceSuite({
      providerName: "Checkout Provider",
      capabilities: {
        required: ["usage"],
        createProvider: () =>
          defineBillingProvider(
            defineBillingProviderProfile({
              providerName: "checkout-provider",
              capabilities: {
                checkout: { supported: true },
                usage: { supported: false, reason: "Usage delivery is unavailable." },
              },
            }),
            { checkout },
          ),
      },
    });

    await suite.cases[0]?.run();
    await expect(suite.cases[1]?.run()).rejects.toMatchObject({
      code: "billing/provider-capability-unavailable",
    });
  });
});

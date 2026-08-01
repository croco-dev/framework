import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  defineBillingProvider,
  defineBillingProviderProfile,
  type BillingGateway,
  type BillingProviderImplementations,
  type BillingProviderProfile,
  type LicensedQuantityGateway,
  type UsageBillingGateway,
} from "../index";
import { ProviderCapabilityUnavailableProblem } from "../libs/problems/BillingProblems";

function createCheckoutGateway(): BillingGateway {
  return {
    ensureCustomer: vi.fn(),
    createCheckout: vi.fn(),
    reconcileCheckout: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
    getCustomerPortalUrl: vi.fn(),
  };
}

function createUsageGateway(): UsageBillingGateway {
  return {
    ingest: vi.fn().mockResolvedValue({
      receipts: [
        { eventId: "event-inserted", status: "inserted" },
        { eventId: "event-duplicate", status: "duplicate" },
      ],
    }),
    getCustomerMeterState: vi.fn().mockResolvedValue({
      billingAccountId: "account-1",
      meterId: "ai.tokens",
      updatedAt: new Date("2026-07-30T00:00:00.000Z"),
      value: 42,
    }),
  };
}

describe("BillingProvider", () => {
  it("keeps checkout-only gateways source-compatible and exposes inspectable capabilities", () => {
    const profile = defineBillingProviderProfile({
      providerName: "checkout-only",
      capabilities: {
        checkout: { supported: true },
        "licensed-quantity": {
          supported: false,
          reason: "Licensed quantity updates are not implemented.",
        },
        usage: { supported: false, reason: "Usage billing is not implemented." },
      },
    });
    const checkout = createCheckoutGateway();
    const provider = defineBillingProvider(profile, { checkout });

    expect(provider.profile).toEqual(profile);
    expect(provider.supports("checkout")).toBe(true);
    expect(provider.supports("usage")).toBe(false);
    expect(provider.requireCapability("checkout")).toBe(checkout);
  });

  it("fails unavailable runtime capability calls with a stable public Problem", () => {
    const provider = defineBillingProvider(
      defineBillingProviderProfile({
        providerName: "checkout-only",
        capabilities: {
          checkout: { supported: true },
          "licensed-quantity": {
            supported: false,
            reason: "Licensed quantity updates are not implemented.",
          },
          usage: { supported: false, reason: "Usage billing is not implemented." },
        },
      }),
      { checkout: createCheckoutGateway() },
    );

    expect(() => provider.requireCapability("usage")).toThrowError(
      ProviderCapabilityUnavailableProblem,
    );
    expect(() => provider.requireCapability("usage")).toThrowError(
      expect.objectContaining({
        code: "billing/provider-capability-unavailable",
        status: 501,
        extensions: {
          capability: "usage",
          providerName: "checkout-only",
        },
      }),
    );
  });

  it("rejects a supported capability without an implementation during runtime composition", () => {
    const profile: BillingProviderProfile = {
      providerName: "dynamic-provider",
      capabilities: {
        checkout: { supported: true },
        "licensed-quantity": { supported: true },
        usage: { supported: true },
      },
    };

    expectTypeOf<BillingProviderImplementations<typeof profile>>().toEqualTypeOf<{
      readonly checkout: BillingGateway;
      readonly "licensed-quantity": LicensedQuantityGateway;
      readonly usage: UsageBillingGateway;
    }>();
    expect(() =>
      defineBillingProvider(profile, {} as BillingProviderImplementations<BillingProviderProfile>),
    ).toThrowError(
      expect.objectContaining({
        code: "billing/provider-capability-unavailable",
        extensions: {
          capability: "checkout",
          providerName: "dynamic-provider",
        },
      }),
    );
  });

  it("rejects licensed-quantity support without a licensed quantity gateway", () => {
    const profile = defineBillingProviderProfile({
      providerName: "licensed-quantity-provider",
      capabilities: {
        checkout: { supported: false, reason: "Checkout is not implemented." },
        "licensed-quantity": { supported: true },
        usage: { supported: false, reason: "Usage billing is not implemented." },
      },
    });

    expect(() =>
      defineBillingProvider(profile, {} as BillingProviderImplementations<typeof profile>),
    ).toThrowError(
      expect.objectContaining({
        code: "billing/provider-capability-unavailable",
        extensions: {
          capability: "licensed-quantity",
          providerName: "licensed-quantity-provider",
        },
      }),
    );
  });

  it("fails explicitly and exposes an inspectable profile when licensed quantity is unsupported", () => {
    const gateway = createCheckoutGateway();
    const provider = defineBillingProvider(
      defineBillingProviderProfile({
        providerName: "checkout-only",
        capabilities: {
          checkout: { supported: true },
          "licensed-quantity": {
            supported: false,
            reason: "Licensed quantity updates are not implemented.",
          },
          usage: { supported: false, reason: "Usage billing is not implemented." },
        },
      }),
      { checkout: gateway },
    );

    expect(provider.profile.capabilities["licensed-quantity"]).toEqual({
      supported: false,
      reason: "Licensed quantity updates are not implemented.",
    });
    expect(() => provider.requireCapability("licensed-quantity")).toThrow(
      ProviderCapabilityUnavailableProblem,
    );
  });

  it("retains usage capability inference and duplicate acknowledgements as receipt data", async () => {
    const usage = createUsageGateway();
    const provider = defineBillingProvider(
      defineBillingProviderProfile({
        providerName: "usage-provider",
        capabilities: {
          checkout: { supported: true },
          "licensed-quantity": {
            supported: false,
            reason: "Licensed quantity updates are not implemented.",
          },
          usage: { supported: true },
        },
      }),
      {
        checkout: createCheckoutGateway(),
        usage,
      },
    );

    const inferredUsage = provider.requireCapability("usage");
    expectTypeOf(inferredUsage).toEqualTypeOf<UsageBillingGateway>();
    await expect(inferredUsage.ingest([])).resolves.toEqual({
      receipts: [
        { eventId: "event-inserted", status: "inserted" },
        { eventId: "event-duplicate", status: "duplicate" },
      ],
    });
  });
});

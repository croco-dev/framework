import { defineBillingProviderProfile } from "@croco/billing-core";

export const POLAR_BILLING_PROVIDER_PROFILE = defineBillingProviderProfile({
  providerName: "polar",
  capabilities: {
    checkout: { supported: true },
    usage: {
      supported: false,
      reason: "Polar usage delivery is not implemented by this package.",
    },
  },
});

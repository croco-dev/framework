import { defineBillingProviderProfile } from "@croco/billing-core";

export const POLAR_BILLING_PROVIDER_PROFILE = defineBillingProviderProfile({
  providerName: "polar",
  capabilities: {
    checkout: { supported: true },
    "licensed-quantity": {
      supported: false,
      reason: "Polar licensed quantity updates are not implemented by this package.",
    },
    usage: { supported: true },
  },
});

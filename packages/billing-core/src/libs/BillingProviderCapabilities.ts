export const BILLING_PROVIDER_CAPABILITIES = ["checkout", "usage"] as const;

export type BillingProviderCapability = (typeof BILLING_PROVIDER_CAPABILITIES)[number];

export type BillingProviderCapabilityAvailability =
  | {
      readonly supported: true;
    }
  | {
      readonly reason: string;
      readonly supported: false;
    };

export type BillingProviderCapabilityProfile = {
  readonly checkout: BillingProviderCapabilityAvailability;
  readonly usage: BillingProviderCapabilityAvailability;
};

export type BillingProviderProfile<
  ProviderName extends string = string,
  Capabilities extends BillingProviderCapabilityProfile = BillingProviderCapabilityProfile,
> = {
  readonly capabilities: Capabilities;
  readonly providerName: ProviderName;
};

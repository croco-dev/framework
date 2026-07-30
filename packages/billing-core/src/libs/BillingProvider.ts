import { ProviderCapabilityUnavailableProblem } from "./problems/BillingProblems";
import type { BillingGateway } from "./BillingGateway";
import { BILLING_PROVIDER_CAPABILITIES } from "./BillingProviderCapabilities";
import type {
  BillingProviderCapability,
  BillingProviderCapabilityProfile,
  BillingProviderProfile,
} from "./BillingProviderCapabilities";
import type { LicensedQuantityGateway } from "./SubscriptionQuantity";
import type { UsageBillingGateway } from "./UsageBillingGateway";

type BillingProviderCapabilityMap = {
  readonly checkout: BillingGateway;
  readonly "licensed-quantity": LicensedQuantityGateway;
  readonly usage: UsageBillingGateway;
};

export type BillingProviderImplementations<Profile extends BillingProviderProfile> = {
  readonly [Capability in BillingProviderCapability as true extends Profile["capabilities"][Capability]["supported"]
    ? Capability
    : never]: BillingProviderCapabilityMap[Capability];
};

export class BillingProvider<Profile extends BillingProviderProfile = BillingProviderProfile> {
  readonly profile: Profile;
  private readonly implementations: Partial<BillingProviderCapabilityMap>;

  constructor(profile: Profile, implementations: BillingProviderImplementations<Profile>) {
    this.profile = profile;
    this.implementations = implementations;

    for (const capability of BILLING_PROVIDER_CAPABILITIES) {
      if (
        profile.capabilities[capability].supported &&
        this.implementations[capability] === undefined
      ) {
        throw new ProviderCapabilityUnavailableProblem(profile.providerName, capability);
      }
    }
  }

  supports(capability: BillingProviderCapability): boolean {
    return this.profile.capabilities[capability].supported;
  }

  requireCapability<Capability extends BillingProviderCapability>(
    capability: Capability,
  ): BillingProviderCapabilityMap[Capability] {
    const implementation = this.implementations[capability];
    if (!this.profile.capabilities[capability].supported || implementation === undefined) {
      throw new ProviderCapabilityUnavailableProblem(this.profile.providerName, capability);
    }

    return implementation;
  }
}

export function defineBillingProviderProfile<
  const ProviderName extends string,
  const Capabilities extends BillingProviderCapabilityProfile,
>(
  profile: BillingProviderProfile<ProviderName, Capabilities>,
): BillingProviderProfile<ProviderName, Capabilities> {
  const capabilities = Object.fromEntries(
    BILLING_PROVIDER_CAPABILITIES.map((capability) => [
      capability,
      Object.freeze({ ...profile.capabilities[capability] }),
    ]),
  );

  return Object.freeze({
    providerName: profile.providerName,
    capabilities: Object.freeze(capabilities),
  }) as BillingProviderProfile<ProviderName, Capabilities>;
}

export function defineBillingProvider<const Profile extends BillingProviderProfile>(
  profile: Profile,
  implementations: BillingProviderImplementations<Profile>,
): BillingProvider<Profile> {
  return new BillingProvider(profile, implementations);
}

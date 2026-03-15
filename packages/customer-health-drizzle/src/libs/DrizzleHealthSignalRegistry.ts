import { HealthSignalRegistry, type SignalProvider } from '@croco/customer-health-core';
import { Component, Inject } from '@croco/framework-context';
import type { BillingSignalProvider } from './BillingSignalProvider';
import type { MeteringSignalProvider } from './MeteringSignalProvider';

@Component()
export class DrizzleHealthSignalRegistry extends HealthSignalRegistry {
  constructor(
    @Inject() private readonly meteringProvider: MeteringSignalProvider,
    @Inject() private readonly billingProvider: BillingSignalProvider
  ) {
    super();
  }

  getProviders(): SignalProvider[] {
    return [this.meteringProvider, this.billingProvider];
  }
}
